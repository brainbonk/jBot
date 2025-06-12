require("dotenv").config();
const { JsonRpcProvider, Contract, Wallet, Interface, ZeroAddress } = require("ethers");
const { abi } = require("./abi.json");
const iface = new Interface(abi);

const SCAN_INTERVAL_MS = 15000;
const REVEAL_INTERVAL_MS = 5000;
const DELAY_INTERVAL_MS = 10000;
const startMinPlayers = 1;
const cancelTimeLimit = 45;

console.log("🎯 Jammy Reveal Bot v1.0 STARTED");
console.log("🔁 Game Scan Interval:", SCAN_INTERVAL_MS / 1000, "sec.");
console.log("🎲 Reveal Num. Interval:", REVEAL_INTERVAL_MS / 1000, "sec.");
console.log("⏳ Reveal Delay Interval:", DELAY_INTERVAL_MS / 1000, "sec.");
console.log("🔴 Cancel time limit:", cancelTimeLimit, "sec.");
console.log("👤 Minimum players to start a game:", startMinPlayers, "players");
console.log("===============================\n");

const firstGameId = 200;
let nextLatestGameId = 0;
let activeNonce = null;
let createdGames = [];
let startedGames = [];
let gameStartTimes = []; // {gameId: ..., timestamp:...}
let pendingStartTxs = [];
let pendingCancelTxs = [];
let pendingRevealTxs = [];
let delayedGames = []; // {gameId: ..., timestamp:...}

const jsonRpcProvider = new JsonRpcProvider(process.env.RPC_URL);
const privSigner = new Wallet(process.env.DEPLOYER_PRIVKEY, jsonRpcProvider);
const contract = new Contract(process.env.CONTRACT_ADDRESS, abi, privSigner);

const moveGameId = (gameId, removeIndex, pushItem, fromArray, toArray) => {
  if (removeIndex === -1) {
    removeIndex = fromArray.indexOf(gameId);
  }
  //remove
  if (removeIndex > -1) {
    fromArray.splice(removeIndex, 1); //.splice(item position, count)
    //add (fromArray olan gameId, toArrayya taşınır. delay olma durumunda böyle olmalı)
    if (toArray !== null) {
      const toArrayIndex = toArray.indexOf(gameId);
      if (toArrayIndex === -1) {
        toArray.push(pushItem);
      }
    }
  }
}

const displayTimeDetail = (gameId, gameStartedIndex) => {
  moveGameId(gameId, gameStartedIndex, null, startedGames, null); // only remove from startedGames

  const gameTimeIndex = gameStartTimes.map(item => item.gameId).indexOf(gameId);
  if (gameTimeIndex > -1) {
    const durationMs = Date.now() - gameStartTimes.find((item)=> item.gameId === gameId).timestamp;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    console.log(
      `[⏱️] Time Detail → Game ${gameId} over in ${minutes}:${seconds} minutes.`
    );
    moveGameId(gameId, gameTimeIndex, null, gameStartTimes, null); // only remove from gameStartTimes
  }
}

const startGame = async (gameId) => {
  try {
    console.log(`[🚀] Game ${gameId} starting...`);
    moveGameId(gameId, -1, gameId, createdGames, pendingStartTxs);

    let startGameTx = await contract.startGame.populateTransaction(gameId);
    startGameTx.chainId = process.env.CHAIN_ID;
    startGameTx.nonce = activeNonce;
    activeNonce++;
    const tx = await privSigner.sendTransaction(startGameTx);
    const receipt = await tx.wait();

    moveGameId(gameId, -1, gameId, pendingStartTxs, startedGames);
    gameStartTimes.push({ gameId, timestamp: Date.now() });
    console.log(`[✅] Game ${gameId} started. → txn: ${receipt?.hash}`);
  } catch (err) {
    moveGameId(gameId, -1, gameId, pendingStartTxs, createdGames);
    console.log(`[❌] ${gameId} startGame-Err: code: ${err.code}, msg: ${err.shortMessage}`);
    if (err.code === "ETIMEDOUT") {
      console.log("timeout interval... retry startgame", gameId);
    }
  }
};

const cancelGame = async (gameId) => {
  try {
    console.log(`[⚠️] Game ${gameId} has less than ${startMinPlayers} players! For this reason it is cancelled.`);
    moveGameId(gameId, -1, gameId, createdGames, pendingCancelTxs);

    let cancelGameTx = await contract.cancelGame.populateTransaction(gameId);
    cancelGameTx.chainId = process.env.CHAIN_ID;
    cancelGameTx.nonce = activeNonce;
    activeNonce++;
    const tx = await privSigner.sendTransaction(cancelGameTx);
    const receipt = await tx.wait();

    moveGameId(gameId, -1, gameId, pendingCancelTxs, null);
    console.log(`[✅] Game ${gameId} cancelled. → txn: ${receipt?.hash}`);
  } catch (err) {
    moveGameId(gameId, -1, gameId, pendingCancelTxs, createdGames);
    console.log(`[❌] ${gameId} cancelGame-Err: code: ${err.code}, msg: ${err.shortMessage}`);
    if (err.code === "ETIMEDOUT") {
      console.log("timeout interval... retry cancelGame", gameId);
    }
  }
};

const initialCheckGames = async () => {
  try {
    activeNonce = await privSigner.getNonce();
    nextLatestGameId = Number(await contract.gameCounter()) + 1;
    for (let gameId = firstGameId; gameId < nextLatestGameId; gameId++) {
      const status = Number(await contract.gameStatus(gameId));
      switch (status) {
        case 1:
          createdGames.push(gameId);
          break;
        case 2:
          startGame(gameId);
          break;
        case 3:
          gameStartTimes.push({ gameId, timestamp: Date.now() });
          startedGames.push(gameId);
          break;
      }
    }
  } catch (err) {
    console.log(`[❌] initialCheckGames Err:`, err);
  }
  console.log("[✔] initial check completed");
};

const checkGamePlayer = async (gameId) => {
  try {
    const game = await contract.games(gameId);
    const startDate = Number(game.startDate);
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    if (startDate - currentTime < cancelTimeLimit) {
      const playerCount =  Number(game.totalPlayerCount);
      if (playerCount < startMinPlayers) {
        cancelGame(gameId);
      }
    }
  } catch (err) {
    console.error("[❌] checkGamePlayer Err:", err);
  }
};

const checkCreatedGames = async () => {
  try {
    createdGames.forEach(async(gameId) => {
      checkGamePlayer(gameId);
      const status = Number(await contract.gameStatus(gameId));
      switch (status) {
        case 2:
          startGame(gameId);
          break;
        case 3:
          gameStartTimes.push({ gameId, timestamp: Date.now() });
          startedGames.push(gameId);
          break;
        case 6:
          console.log(`[🔴] Game ${gameId} cancelled.`);
          moveGameId(gameId, -1, null, createdGames, null); // only remove from createdGames
          break;
      }
    });
  } catch (err) {
    console.error(`[❌] checkCreatedGames Err:`, err);
  }
};

const checkStartedGames = async () => {
  try {
    startedGames.forEach(async(gameId, index) => {
      const status = Number(await contract.gameStatus(gameId));
      if (status > 3) {
        console.log(
          `[🔵] Game ${gameId} tracking is over. → status: ${
            status === 4 ? "Ended" : status === 5 ? "Expired" : "Cancelled"
          }.`
        );
        displayTimeDetail(gameId, index);
      } else {
        const revealedNumCount = Number(
          (await contract.getGameInfo(gameId, ZeroAddress, 0)).numbersLength
        );
        if (revealedNumCount === 0) {
          console.log(
            `[⚠] Game ${gameId} → 75 sayı çekildi ve Jammy ödülü alınmadı. Takip bitti.`
          );
          displayTimeDetail(gameId, index);
        } else {
          if ((75 - revealedNumCount) > 0) {
            console.log(
              `[🟡] Game ${gameId} → ${75 - revealedNumCount}/75 revealed.`
            );
          } else {
            console.log(`[🟡] Game ${gameId} → started reveal cycle...`);
          }
        }
      }
    });
  } catch (err) {
    console.log("[❌] checkStartedGames Err:", err);
  }
};

const revealNum = async (gameId) => {
  try {
    moveGameId(gameId, -1, gameId, startedGames, pendingRevealTxs);
    const revealNumTx = await contract.revealNumber.populateTransaction(gameId);
    revealNumTx.chainId = process.env.CHAIN_ID;
    revealNumTx.nonce = activeNonce;
    activeNonce++;
    const tx = await privSigner.sendTransaction(revealNumTx);
    const receipt = await tx.wait();
    if (receipt) {
      console.log(
        `[📊] Game ${gameId} → Revealed Num: ${iface.parseLog(receipt?.logs[0])?.args.revealedNum} → txn: ${receipt?.hash}`
      );
    } else {
      console.log(`[✘] Game ${gameId} → receipt not found!`);
    }
    moveGameId(gameId, -1, gameId, pendingRevealTxs, startedGames);
    return true;
  } catch (err) {
    moveGameId(gameId, -1, gameId, pendingRevealTxs, startedGames);
    console.log(`[❌] ${gameId} revealNum-Err: code: ${err.code}, msg: ${err.shortMessage}`);
    if (err.code === "ETIMEDOUT") {
      console.log("timeout interval... retry revealNum", gameId);
    }
    return false;
  }
};

const checkDelayGames = () => {
  try {
    if (delayedGames.length > 0) {
      const currentTime = Date.now();
      delayedGames.forEach((item, index) => {
        const elapsedTime = currentTime - item.timestamp;
        if (elapsedTime >= DELAY_INTERVAL_MS) {
          console.log(`### >>> Reveal Delay Finished: Game ${item.gameId} is ready to reveal.`);
          moveGameId(item.gameId, index, item.gameId, delayedGames, startedGames);
        }
      });
    }
  } catch (err) {
    console.error("[❌] checkDelayGames Err:", err);
  }
};

(async () => {
  // --- Event Listeners
  const listenerPrizeWon = (gameId, PrizeIndex, winner, winnerCard, event) => {
    // console.log("### >>> PrizeWon Emitted:", gameId, PrizeIndex, winner);
    console.log(`### >>> Reveal Delayed: Game ${Number(gameId)}`);
    const indexInStarted = startedGames.indexOf(Number(gameId));
    if (indexInStarted > -1) {
      moveGameId(Number(gameId), indexInStarted, { gameId: Number(gameId), timestamp: Date.now() }, startedGames, delayedGames);
      return;
    }

    const indexInPending = pendingRevealTxs.indexOf(Number(gameId));
    if (indexInPending > -1) {
      moveGameId(Number(gameId), indexInPending, { gameId: Number(gameId), timestamp: Date.now() }, pendingRevealTxs, delayedGames);
      return;
    }
  };
  contract.on("PrizeWon", listenerPrizeWon);
  // --- Event Listeners

  await initialCheckGames();
  // Scan Cycle
  setInterval(async () => {
    try {
      console.log(`---> Scan Cycle >>> nextLatestGameId: ${nextLatestGameId}, createdGames: ${JSON.stringify(createdGames)}, startedGames: ${JSON.stringify(startedGames)}`);
      const latestGameId = Number(await contract.gameCounter());
      activeNonce = await privSigner.getNonce();

      //catch new game (nextLatestGameId yeni oyun geldikçe ileri taşınır)
      for (nextLatestGameId; nextLatestGameId <= latestGameId; nextLatestGameId++) {
        const status = Number(await contract.gameStatus(nextLatestGameId));
        switch (status) {
          case 1:
            if (!createdGames.find((item)=> item === nextLatestGameId)) {
              console.log(`[🚀] Game ${nextLatestGameId} created.`);
              createdGames.push(nextLatestGameId);
            } else {console.log("else-createdGames.find", nextLatestGameId)}
            break;
          case 2:
            startGame(nextLatestGameId);
            break;
          case 3:
            if (!startedGames.find((item)=> item === nextLatestGameId)) {
              gameStartTimes.push({ gameId, timestamp: Date.now() });
              startedGames.push(nextLatestGameId);
            } else {console.log("else-startedGames.find", nextLatestGameId)}
            break;
        }
      }
      checkCreatedGames();
      checkStartedGames();
    } catch (error) {
      console.error("[❌] Scan Cycle Interval Error:", error);
    }
  }, SCAN_INTERVAL_MS);

  // Reveal Num. Cycle
  setInterval(async () => {
    checkDelayGames();
    console.log(`-> revealNum Cycle >>> ${JSON.stringify(startedGames)} : ${JSON.stringify(pendingRevealTxs)} : ${JSON.stringify(delayedGames)}`);
    try {
      if (startedGames.length > 0) {
        activeNonce = await privSigner.getNonce();
        startedGames.forEach(async (gameId) => {
          console.log("> revealNum game:", gameId);
          revealNum(gameId);
        });
      }
    } catch (error) {
      console.error("[❌] Reveal Cycle Interval Error:", error);
    }
  }, REVEAL_INTERVAL_MS);
})();
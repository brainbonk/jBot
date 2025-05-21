require("dotenv").config();
const { JsonRpcProvider, Contract, Wallet, ZeroAddress } = require("ethers");
const { abi } = require("./abi.json");

const REVEAL_INTERVAL_MS = 3000;
const SCAN_INTERVAL_MS = 9000;

console.log("🎯 Bot Started...");
console.log("🔁 Game Scan Interval:", SCAN_INTERVAL_MS / 1000, "sec.");
console.log("🎲 Reveal Num. Interval:", REVEAL_INTERVAL_MS / 1000, "sec.");
console.log("===============================\n");

let lastLatestGameId = 0;
let createdGames = [];
let startedGames = [];

const gameStartTimes = {};

const jsonRpcProvider = new JsonRpcProvider(process.env.RPC_URL);
const privSigner = new Wallet(process.env.DEPLOYER_PRIVKEY, jsonRpcProvider);
const contract = new Contract(process.env.CONTRACT_ADDRESS, abi, privSigner);

const startGame = async (_gameId) => {
  try {
    console.log(`[🚀] Game ${_gameId} starting...`);
    // let startGameTx = await contract.startGame.populateTransaction(gameId);
    // startGameTx.chainId = process.env.CHAIN_ID;
    // const tx = await privSigner.sendTransaction(startGameTx);
    // const receipt = await tx.wait();
    startedGames.push(_gameId);
    console.log(`[✅] Game ${_gameId} started. → txn: ${receipt.hash}`);
  } catch (err) {
    console.error(`[❌] startGame-Err:`, err);
  }
};

const initialCheckGames = async () => {
  try {
    lastLatestGameId = Number(await contract.gameCounter());
    for (let gameId = 150; gameId <= lastLatestGameId; gameId++) {
      const status = Number(await contract.gameStatus(gameId));

      switch (status) {
        case 1:
          createdGames.push(gameId);
          break;
        case 2:
          startGame(gameId);
          break;
        case 3:
          startedGames.push(gameId);
          break;
      }
    }
  } catch (err) {
    console.log(`[❌] initialCheckGames Err:`, err);
  }
  console.log("[✔] initial completed");
};

const checkCreatedGames = async () => {
  try {
    createdGames.forEach(async(gameId) => {
      const status = Number(await contract.gameStatus(gameId));
      switch (status) {
        case 2:
          startGame(gameId);
          break;
        case 3:
          startedGames.push(gameId);
          break;
      }
    });
  } catch (err) {
    console.error(`[❌] checkCreatedGames Err:`, err);
  }
};

const checkStartedGames = async () => {
  try {
    startedGames.forEach(async(gameId) => {
      const status = Number(await contract.gameStatus(gameId));
      let isEnded = false;

      if (status > 3) {
        console.log(
          `[🔵] Game ${gameId} tracking is over. → status: ${
            status === 4 ? "Ended" : status === 5 ? "Expired" : "Cancelled"
          }.`
        );
        if (gameStartTimes[gameId]) {
          const durationMs = Date.now() - gameStartTimes[gameId];
          const minutes = Math.floor(durationMs / 60000);
          const seconds = Math.floor((durationMs % 60000) / 1000);
          console.log(
            `[⏱️] Game ${gameId} completed. → The game over in ${minutes}:${seconds} minutes.`
          );
        } else {
          console.log(
            `[✅] Game ${gameId} completed.`
          );
        }
        startedGames.pop(gameId)
        isEnded = true;
      } else {
        const revealedNumCount = Number(
          (await contract.getGameInfo(gameId, ZeroAddress, 0)).numbersLength
        );
        if (revealedNumCount === 0) {
          console.log(
            `[⚠] Game ${gameId} → 75 sayı çekildi ve Jammy ödülü alınmadı. Takip bitti.`
          );
          startedGames.pop(gameId)
          isEnded = true;
        }
      }

      if (isEnded === false && status === 3 && !startedGames.find((item)=> item === gameId)) {
        startedGames.push(gameId);
        gameStartTimes[gameId] = Date.now();
        console.log(`[🟡] Game ${gameId} started. Reveal başladı.`);
      }
    });
  } catch (err) {
    console.log("[❌] checkStartedGames Err:", err);
  }
};

const revealNum = async (gameId, retry = 0) => {
  try {
    // const revealNumTx = await contract.revealNumber.populateTransaction(gameId);
    // revealNumTx.chainId = 421614;
    // const tx = await privSigner.sendTransaction(revealNumTx);
    // const receipt = await tx.wait();
    const receipt = null;
    if (receipt) {
      console.log(`[✔] Game ${gameId}: Sayı çekildi → TX: ${receipt?.hash}`);
      console.log(
        `[📊] Game ${gameId} → Revealed Num: ${receipt?.logs?.args.revealNum}`
      );
    } else {
      console.log(`[✘] Game ${gameId} → receipt not found!`);
    }
    return true;
  } catch (err) {
    console.log(`[✘] ${gameId} revealNum Err: ${err}`);
    if (retry < 3) {
      console.log(`[↻] Game ${gameId} → retry revealNum... (${retry + 1}/3)`);
      // return await reveal(gameId, retry + 1);
    }
    return false;
  }
};

(async () => {
  await initialCheckGames();
  // Scan Cycle
  setInterval(async () => {
    const latestGameId = Number(await contract.gameCounter());
    for (lastLatestGameId; lastLatestGameId < latestGameId; ++lastLatestGameId) {
      const status = Number(await contract.gameStatus(lastLatestGameId));
      switch (status) {
        case 1:
          console.log(`[🚀] Game ${lastLatestGameId} created.`);
          createdGames.push(lastLatestGameId);
          break;
        case 2:
          startGame(lastLatestGameId);
          break;
        case 3:
          startedGames.push(lastLatestGameId);
          break;
      }
    }
    checkCreatedGames();
    checkStartedGames();
  }, SCAN_INTERVAL_MS);

  // Reveal Num. Cycle
  setInterval(async () => {
    console.log("--> revealNum Cycle", createdGames, startedGames);
    if (startedGames.length > 0) {
      startedGames.forEach(async (_gameId) => {
        console.log("revealNum cycle", _gameId);
        
        // const success = await revealNum(_gameId, 0);
        // if (!success) {
        //   console.log(
        //     `[✘] Game ${_gameId} → 3 deneme başarısız. Geçici olarak durduruldu.`
        //   );
        // }
      });
    }
  }, REVEAL_INTERVAL_MS);
})();
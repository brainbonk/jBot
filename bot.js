require("dotenv").config();
const { JsonRpcProvider, Contract, Wallet, ZeroAddress, Interface } = require("ethers");
const { abi } = require("./abi.json");
const iface = new Interface(abi);

const REVEAL_INTERVAL_MS = 6000;
const SCAN_INTERVAL_MS = 18000;

console.log("🎯 Bot Started...");
console.log("🔁 Game Scan Interval:", SCAN_INTERVAL_MS / 1000, "sec.");
console.log("🎲 Reveal Num. Interval:", REVEAL_INTERVAL_MS / 1000, "sec.");
console.log("===============================\n");

let activeNonce = null;
const firstGameId = 170;
let nextLatestGameId = 0;
let createdGames = [];
let startedGames = [];

const gameStartTimes = {};

const jsonRpcProvider = new JsonRpcProvider(process.env.RPC_URL);
const privSigner = new Wallet(process.env.DEPLOYER_PRIVKEY, jsonRpcProvider);
const contract = new Contract(process.env.CONTRACT_ADDRESS, abi, privSigner);

//-OK
const startGame = async (_gameId) => {
  try {
    console.log(`[🚀] Game ${_gameId} starting...`);
    let startGameTx = await contract.startGame.populateTransaction(_gameId);
    startGameTx.chainId = process.env.CHAIN_ID;
    startGameTx.nonce = activeNonce;
    console.log(">>> usedNonce (start):", activeNonce, _gameId);
    activeNonce++;
    const tx = await privSigner.sendTransaction(startGameTx);
    const receipt = await tx.wait();

    const index_removeGameId = createdGames.indexOf(_gameId);
    if (index_removeGameId > -1) {
      createdGames.splice(index_removeGameId, 1); //(item position, count)
    }
    if (!startedGames.find((item)=> item === _gameId)) {
      startedGames.push(_gameId);
      gameStartTimes[_gameId] = Date.now();
    }
    // console.log(`[✅] Game ${_gameId} started. → txn: 0xabc...`); //test log
    console.log(`[✅] Game ${_gameId} started. → txn: ${receipt?.hash}`);
  } catch (err) {
    console.log(`[❌] ${_gameId} startGame-Err: code: ${err.code}, msg: ${err.shortMessage}`);
    if (err.code === "ETIMEDOUT") {
      console.log("timeout interval... retry startgame", _gameId);
      startGame(_gameId);
    }
  }
};

//-OK
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
          startedGames.push(gameId);
          break;
      }
    }
  } catch (err) {
    console.log(`[❌] initialCheckGames Err:`, err);
  }
  console.log("[✔] initial check completed");
};

//-OK
const checkCreatedGames = async () => {
  try {
    //forEach asenkron döngü yaratır bu da istediğimiz bişey
    createdGames.forEach(async(gameId, index) => {
      const status = Number(await contract.gameStatus(gameId));
      switch (status) {
        case 2:
          startGame(gameId);
          break;
        case 3:
          startedGames.push(gameId);
          break;
        case 6:
          console.log(`[✘] Game ${gameId} cancelled.`);
          createdGames.splice(index, 1); //(item position, count)
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
            `[⏱️-✅] Game ${gameId} completed. → The game over in ${minutes}:${seconds} minutes.`
          );
        } else {
          console.log(
            `[✅] Game ${gameId} completed.`
          );
        }
        startedGames.splice(index, 1); //(item position, count)
        if (gameStartTimes[gameId]) {
          gameStartTimes.delete(gameId);
        }
        isEnded = true;
      } else {
        const revealedNumCount = Number(
          (await contract.getGameInfo(gameId, ZeroAddress, 0)).numbersLength
        );
        if (revealedNumCount === 0) {
          console.log(
            `[⚠] Game ${gameId} → 75 sayı çekildi ve Jammy ödülü alınmadı. Takip bitti.`
          );
          startedGames.splice(index, 1); //(item position, count)
          if (gameStartTimes[gameId]) {
            gameStartTimes.delete(gameId);
          }
          isEnded = true;
        } else {
          if ((75 - revealedNumCount) > 0) {
            console.log(
              `[🟡] Game ${gameId} → ${75 - revealedNumCount}/75 revealed.`
            );
          } else {
            console.log(`[🟡] Game ${gameId} → started reveal cycle...`);
            // revealNum(gameId, 0);
          }
        }
      }

      // if (isEnded === false && status === 3 && !startedGames.find((item)=> item === gameId)) {
      //   // startedGames.push(gameId);
      //   // gameStartTimes[gameId] = Date.now();
      //   console.log(`[🟡] Game ${gameId} started. Reveal başladı.`);
      // }
    });
  } catch (err) {
    console.log("[❌] checkStartedGames Err:", err);
  }
};

const revealNum = async (gameId, retry = 0) => {
  try {
    // const nonce = await privSigner.getNonce();
    // console.log("noce:", nonce, gameId);
    
    const revealNumTx = await contract.revealNumber.populateTransaction(gameId);
    revealNumTx.chainId = process.env.CHAIN_ID;
    revealNumTx.nonce = activeNonce;
    console.log(">>> usedNonce (reveal):", activeNonce, gameId);
    activeNonce++;
    const tx = await privSigner.sendTransaction(revealNumTx);
    const receipt = await tx.wait();
    // const receipt = null;
    if (receipt) {
      console.log(
        `[📊] Game ${gameId} → Revealed Num: ${iface.parseLog(receipt?.logs[0])?.args.revealedNum} → txn: ${receipt?.hash}`
      );
    } else {
      console.log(`[✘] Game ${gameId} → receipt not found!`);
    }
    return true;
  } catch (err) {
    console.log(`[❌] ${gameId} revealNum-Err: code: ${err.code}, msg: ${err.shortMessage}`);
    // if (retry < 3) {
    //   console.log(`[↻] Game ${gameId} → retry revealNum... (${retry + 1}/3)`);
    //   // return await reveal(gameId, retry + 1);
    // }
    if (err.code === "ETIMEDOUT") {
      console.log("timeout interval... retry revealNum", gameId);
      revealNum(gameId, 0);
    }
    return false;
  }
};

(async () => {
  // const listenerNR = (gameId, revealedNum, event) => {
  //   console.log(">>>> listen:", gameId, revealedNum);
  //   revealNum(gameId, 0);
  // };
  // contract.on("NumberRevealed", listenerNR);

  await initialCheckGames();

  // Scan Cycle
  setInterval(async () => {
    console.log(`---> Scan Cycle > nextLatestGameId: ${nextLatestGameId}, createdGames: ${JSON.stringify(createdGames)}, startedGames: ${JSON.stringify(startedGames)}, gameStartTimes: ${JSON.stringify(gameStartTimes)}`);
    const latestGameId = Number(await contract.gameCounter());
    activeNonce = await privSigner.getNonce();

    //-OK
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
        //çoğunlukla case 2-3 denk gelmez ama her ihtimale karşı olması gerekiyor.
        case 2:
          startGame(nextLatestGameId);
          break;
        case 3:
          if (!startedGames.find((item)=> item === nextLatestGameId)) {
            startedGames.push(nextLatestGameId);
          } else {console.log("else-startedGames.find", nextLatestGameId)}
          break;
      }
    }

    checkCreatedGames(); //-OK
    checkStartedGames();
  }, SCAN_INTERVAL_MS);

  // // Reveal Cycle
  setInterval(async () => {
    if (startedGames.length > 0) {
      activeNonce = await privSigner.getNonce();
      // for (let i = 0; i < startedGames.length; i++) {
      //   await revealNum(startedGames[i], 0);
      // }
      startedGames.forEach((_gameId) => {
        // console.log("revealNum cycle game ids:", _gameId);
        revealNum(_gameId, 0);
        
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
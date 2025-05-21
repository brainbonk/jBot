async function getDrawnCount(gameId) {
  let count = 0;
  for (let i = 1; i <= 75; i++) {
    const isDrawn = await contract.drawnNumbers(gameId, i);
    if (isDrawn) count++;
  }
  return count;
}

async function reveal(gameId, index, retry = 0) {
  try {
    const revealNumTx = await contract.revealNumber.populateTransaction(gameId);
    revealNumTx.chainId = 421614;
    const tx = await privSigner.sendTransaction(revealNumTx);
    const receipt = await tx.wait();

    console.log(`[✔] Game ${gameId}: Sayı çekildi → TX: ${receipt.hash}`);
    console.log(`[📊] Game ${gameId} → Bu, ${index}. çekilen sayı.`);
    return true;
  } catch (err) {
    console.error(`[✘] Game ${gameId} reveal error: ${err.message}`);
    if (retry < 3) {
      console.log(`[↻] Game ${gameId} → Tekrar deneniyor... (${retry + 1}/3)`);
      return await reveal(gameId, index, retry + 1);
    }
    return false;
  }
}

async function runRevealLoop(gameId) {
  const interval = setInterval(async () => {
    try {
      const status = await contract.gameStatus(gameId);
      const drawnCount = await getDrawnCount(gameId);

      if (status != 3) {
        console.log(`[🔵] Game ${gameId} ENDED. Takip durduruldu.`);
        clearInterval(interval);
        activeReveals.delete(gameId);
        endedGames.add(gameId);
        if (gameStartTimes[gameId]) {
          const durationMs = Date.now() - gameStartTimes[gameId];
          const minutes = Math.floor(durationMs / 60000);
          const seconds = Math.floor((durationMs % 60000) / 1000);
          console.log(
            `[⏱️] Game ${gameId} tamamlandı. Süre: ${minutes} dakika ${seconds} saniye.`
          );
        }
        return;
      }

      if (drawnCount >= 75) {
        console.warn(
          `[⚠] Game ${gameId} → 75 sayı çekilmiş. Takipten çıkıldı.`
        );
        clearInterval(interval);
        activeReveals.delete(gameId);
        endedGames.add(gameId);
        return;
      }

      const success = await reveal(gameId, drawnCount + 1);
      if (!success) {
        console.warn(
          `[✘] Game ${gameId} → 3 deneme başarısız. Geçici olarak durduruldu.`
        );
      }
    } catch (e) {
      console.error(`[ERROR] Game ${gameId} loop crash: ${e.message}`);
    }
  }, REVEAL_INTERVAL_MS);
}

async function tryStartReadyGames() {
  try {
    const latest = Number(await contract.gameCounter());
    if (lastSeenReadyId === latest)
      return console.log("Ready oyun henüz bulunamadı.");

    const now = Math.floor(Date.now() / 1000);

    for (let gameId = lastSeenReadyId; gameId <= latest; gameId++) {
      const status = Number(await contract.gameStatus(gameId));
      if (status == 2) {
        const game = await contract.games(gameId);

        if (Number(game.startDate) <= now) {
          console.log(`[🚀] Game ${gameId} READY. Başlatılıyor...`);

          const startGameTx = await contract.startGame.populateTransaction(
            gameId
          );
          startGameTx.chainId = 421614;
          const tx = await privSigner.sendTransaction(startGameTx);
          const receipt = await tx.wait();

          console.log(`[✅] Game ${gameId} başlatıldı → TX: ${receipt.hash}`);

          console.log("Başlatılan oyun detayları:", {
            game,
            cardPrice: game.cardPrice,
            totalCardsSold: game.totalCardsSold,
            totalPlayerCount: game.totalPlayerCount,
          });

          lastSeenReadyId = latest;
          console.log("En son ready bulunan gameId:", lastSeenReadyId);
        }
      }
    }
  } catch (err) {
    console.error(`[START ERROR]`, err.message);
  }
}

async function checkStartedGames() {
  console.log("🔁 CREATED, READY or STARTED Games Scanning...");

  await tryStartReadyGames();

  try {
    const latest = Number(await contract.gameCounter());

    // Yeni oyun kontrolü
    if (Number(latest) > lastSeenId) {
      for (let gameId = lastSeenId + 1; gameId <= latest; gameId++) {
        console.log(`🆕 Yeni oyun tespit edildi → Game ${gameId}`);
      }
      lastSeenId = Number(latest);
    }

    for (let gameId = 1; gameId <= latest; gameId++) {
      const status = Number(await contract.gameStatus(gameId));
      if (
        status == 3 &&
        !activeReveals.has(gameId) &&
        !endedGames.has(gameId)
      ) {
        console.log(`[🟡] Game ${gameId} STARTED. Reveal döngüsü başlıyor.`);
        const game = await contract.games(gameId);
        console.log("Reveal döngüsü başlatılan oyun detayları:", {
          game,
          cardPrice: game.cardPrice,
          totalCardsSold: game.totalCardsSold,
          totalPlayerCount: game.totalPlayerCount,
        });
        activeReveals.add(gameId);
        gameStartTimes[gameId] = Date.now();
        runRevealLoop(gameId);
      }
    }
  } catch (e) {
    console.error("[❌] checkStartedGames Err:", e.message);
  }
}

require("dotenv").config();
const { JsonRpcProvider, Contract, Wallet, ZeroAddress } = require("ethers");

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

const ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_vrfCoordinator",
        type: "address",
      },
      {
        internalType: "bytes32",
        name: "_keyhash",
        type: "bytes32",
      },
      {
        internalType: "uint256",
        name: "_subscriptionId",
        type: "uint256",
      },
      {
        internalType: "uint32",
        name: "_callbackGasLimit",
        type: "uint32",
      },
      {
        internalType: "uint256",
        name: "_team1Shares",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_team2Shares",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "_team1Address",
        type: "address",
      },
      {
        internalType: "address",
        name: "_team2Address",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "AlreadyInWinnersList",
    type: "error",
  },
  {
    inputs: [],
    name: "AlreadyJoined",
    type: "error",
  },
  {
    inputs: [],
    name: "AlreadyRefunded",
    type: "error",
  },
  {
    inputs: [],
    name: "CardDoesNotWin",
    type: "error",
  },
  {
    inputs: [],
    name: "CardNotFound",
    type: "error",
  },
  {
    inputs: [],
    name: "CardNotReady",
    type: "error",
  },
  {
    inputs: [],
    name: "CardsSoldOut",
    type: "error",
  },
  {
    inputs: [],
    name: "CatchFire",
    type: "error",
  },
  {
    inputs: [],
    name: "GameAlreadyStarted",
    type: "error",
  },
  {
    inputs: [],
    name: "InputValidation",
    type: "error",
  },
  {
    inputs: [],
    name: "NoCardFound",
    type: "error",
  },
  {
    inputs: [],
    name: "NothingToRefund",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "have",
        type: "address",
      },
      {
        internalType: "address",
        name: "want",
        type: "address",
      },
    ],
    name: "OnlyCoordinatorCanFulfill",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "have",
        type: "address",
      },
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        internalType: "address",
        name: "coordinator",
        type: "address",
      },
    ],
    name: "OnlyOwnerOrCoordinator",
    type: "error",
  },
  {
    inputs: [],
    name: "PendingSeed",
    type: "error",
  },
  {
    inputs: [],
    name: "PrizeAlreadyClaimed",
    type: "error",
  },
  {
    inputs: [],
    name: "PrizeAlreadyWon",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "reqId",
        type: "uint256",
      },
    ],
    name: "ReqNotFound",
    type: "error",
  },
  {
    inputs: [],
    name: "TransferFailed",
    type: "error",
  },
  {
    inputs: [],
    name: "Unauthorized",
    type: "error",
  },
  {
    inputs: [],
    name: "UnknownRequest",
    type: "error",
  },
  {
    inputs: [],
    name: "WrongAmount",
    type: "error",
  },
  {
    inputs: [],
    name: "WrongGameStatus",
    type: "error",
  },
  {
    inputs: [],
    name: "WrongPayment",
    type: "error",
  },
  {
    inputs: [],
    name: "ZeroAddress",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "state",
        type: "bool",
      },
    ],
    name: "AdminSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "player",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "playerCardIndex",
        type: "uint256",
      },
    ],
    name: "CardRedrawn",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newCount",
        type: "uint256",
      },
    ],
    name: "CardsAdded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "CardsUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "vrfCoordinator",
        type: "address",
      },
    ],
    name: "CoordinatorSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
    ],
    name: "GameCancelled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "host",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "startDate",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "maxCardsPerPlayer",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "cardPrice",
        type: "uint256",
      },
    ],
    name: "GameCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
    ],
    name: "GameEnds",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
    ],
    name: "GameStarted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "state",
        type: "bool",
      },
    ],
    name: "HostSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "revealedNum",
        type: "uint8",
      },
    ],
    name: "NumberRevealed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address",
      },
    ],
    name: "OwnershipTransferRequested",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "player",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "cardsCount",
        type: "uint256",
      },
    ],
    name: "PlayerJoined",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "totalAmount",
        type: "uint256",
      },
    ],
    name: "PrizeCollected",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "prizeIndex",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "address",
        name: "winner",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "winnerCard",
        type: "uint256",
      },
    ],
    name: "PrizeWon",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "RefundSent",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "requestId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "enum IJammy.RandomRequestType",
        name: "reqType",
        type: "uint8",
      },
      {
        indexed: false,
        internalType: "address",
        name: "player",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "numberOfWords",
        type: "uint256",
      },
    ],
    name: "RequestFulfilled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "requestId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint32",
        name: "numberOfWords",
        type: "uint32",
      },
    ],
    name: "RequestSent",
    type: "event",
  },
  {
    inputs: [],
    name: "EXPIRATION_DURATION",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MAX_NUMBER",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "PRECISION_BASIS",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "PRIZE_COUNT",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "acceptOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "admins",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "availableNumbers",
    outputs: [
      {
        internalType: "uint8",
        name: "",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[]",
        name: "newCards",
        type: "uint256[]",
      },
    ],
    name: "batchAddCards",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[]",
        name: "indexes",
        type: "uint256[]",
      },
      {
        internalType: "uint256[]",
        name: "newCards",
        type: "uint256[]",
      },
    ],
    name: "batchUpdateCards",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "callbackGasLimit",
    outputs: [
      {
        internalType: "uint32",
        name: "",
        type: "uint32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
    ],
    name: "cancelGame",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "cards",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
    ],
    name: "claimPrize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
    ],
    name: "claimRefund",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "startDate",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxCardsPerPlayer",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "cardPrice",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "houseShare",
        type: "uint256",
      },
      {
        internalType: "uint256[]",
        name: "prizeShares",
        type: "uint256[]",
      },
    ],
    name: "createGame",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "deployer",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint8",
        name: "",
        type: "uint8",
      },
    ],
    name: "drawnNumbers",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "gameCounter",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "gamePrizes",
    outputs: [
      {
        internalType: "uint256",
        name: "share",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "won",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
    ],
    name: "gameStatus",
    outputs: [
      {
        internalType: "enum IJammy.GameStatus",
        name: "",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "games",
    outputs: [
      {
        internalType: "address",
        name: "host",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "startDate",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxCardsPerPlayer",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "cardPrice",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "totalCardsSold",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "houseShare",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "seed",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "cancelled",
        type: "bool",
      },
      {
        internalType: "uint256",
        name: "totalPlayerCount",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getCards",
    outputs: [
      {
        internalType: "uint256[]",
        name: "allCards",
        type: "uint256[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "playerAddr",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "prizeIndex",
        type: "uint256",
      },
    ],
    name: "getGameInfo",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "availableNumbersLength",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "gamePrizesLength",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "prizeWinnersLength",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "numbersLength",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "cardsLength",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "playerCardsLength",
            type: "uint256",
          },
        ],
        internalType: "struct IJammy.GetInfo",
        name: "info",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "hosts",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "cardsCount",
        type: "uint256",
      },
    ],
    name: "joinGame",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "keyhash",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "numbers",
    outputs: [
      {
        internalType: "uint8",
        name: "",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "pendingFunds",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "playerCards",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "prizeWinners",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "prizesClaimed",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "randomRequests",
    outputs: [
      {
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "player",
        type: "address",
      },
      {
        internalType: "enum IJammy.RandomRequestType",
        name: "requestType",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "requestId",
        type: "uint256",
      },
      {
        internalType: "uint256[]",
        name: "randomWords",
        type: "uint256[]",
      },
    ],
    name: "rawFulfillRandomWords",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "playerCardIndex",
        type: "uint256",
      },
    ],
    name: "redrawCard",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "refunds",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
    ],
    name: "revealNumber",
    outputs: [
      {
        internalType: "uint8",
        name: "revealedNumber",
        type: "uint8",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "revealedCards",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "s_vrfCoordinator",
    outputs: [
      {
        internalType: "contract IVRFCoordinatorV2Plus",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "addr",
        type: "address",
      },
      {
        internalType: "bool",
        name: "state",
        type: "bool",
      },
    ],
    name: "setAdmin",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_vrfCoordinator",
        type: "address",
      },
    ],
    name: "setCoordinator",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "addr",
        type: "address",
      },
      {
        internalType: "bool",
        name: "state",
        type: "bool",
      },
    ],
    name: "setHost",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
    ],
    name: "startGame",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "subscriptionId",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "team1Address",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "team1Shares",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "team2Address",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "team2Shares",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "vrfCoordinator",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "gameId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "prizeIndex",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "playerCardIndex",
        type: "uint256",
      },
    ],
    name: "winPrize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const jsonRpcProvider = new JsonRpcProvider(process.env.RPC_URL);
const privSigner = new Wallet(process.env.DEPLOYER_PRIVKEY, jsonRpcProvider);
const contract = new Contract(process.env.CONTRACT_ADDRESS, ABI, privSigner);

// async function getDrawnCount(gameId) {
//   let count = 0;
//   for (let i = 1; i <= 75; i++) {
//     const isDrawn = await contract.drawnNumbers(gameId, i);
//     if (isDrawn) count++;
//   }
//   return count;
// }

// async function reveal(gameId, index, retry = 0) {
//   try {
//     const revealNumTx = await contract.revealNumber.populateTransaction(gameId);
//     revealNumTx.chainId = 421614;
//     const tx = await privSigner.sendTransaction(revealNumTx);
//     const receipt = await tx.wait();

//     console.log(`[✔] Game ${gameId}: Sayı çekildi → TX: ${receipt.hash}`);
//     console.log(`[📊] Game ${gameId} → Bu, ${index}. çekilen sayı.`);
//     return true;
//   } catch (err) {
//     console.error(`[✘] Game ${gameId} reveal error: ${err.message}`);
//     if (retry < 3) {
//       console.log(`[↻] Game ${gameId} → Tekrar deneniyor... (${retry + 1}/3)`);
//       return await reveal(gameId, index, retry + 1);
//     }
//     return false;
//   }
// }

// async function runRevealLoop(gameId) {
//   const interval = setInterval(async () => {
//     try {
//       const status = await contract.gameStatus(gameId);
//       const drawnCount = await getDrawnCount(gameId);

//       if (status != 3) {
//         console.log(`[🔵] Game ${gameId} ENDED. Takip durduruldu.`);
//         clearInterval(interval);
//         activeReveals.delete(gameId);
//         endedGames.add(gameId);
//         if (gameStartTimes[gameId]) {
//           const durationMs = Date.now() - gameStartTimes[gameId];
//           const minutes = Math.floor(durationMs / 60000);
//           const seconds = Math.floor((durationMs % 60000) / 1000);
//           console.log(
//             `[⏱️] Game ${gameId} tamamlandı. Süre: ${minutes} dakika ${seconds} saniye.`
//           );
//         }
//         return;
//       }

//       if (drawnCount >= 75) {
//         console.warn(
//           `[⚠] Game ${gameId} → 75 sayı çekilmiş. Takipten çıkıldı.`
//         );
//         clearInterval(interval);
//         activeReveals.delete(gameId);
//         endedGames.add(gameId);
//         return;
//       }

//       const success = await reveal(gameId, drawnCount + 1);
//       if (!success) {
//         console.warn(
//           `[✘] Game ${gameId} → 3 deneme başarısız. Geçici olarak durduruldu.`
//         );
//       }
//     } catch (e) {
//       console.error(`[ERROR] Game ${gameId} loop crash: ${e.message}`);
//     }
//   }, REVEAL_INTERVAL_MS);
// }

// async function tryStartReadyGames() {
//   try {
//     const latest = Number(await contract.gameCounter());
//     if (lastSeenReadyId === latest) return console.log("Ready oyun henüz bulunamadı.");

//     const now = Math.floor(Date.now() / 1000);

//     for (let gameId = lastSeenReadyId; gameId <= latest; gameId++) {
//       const status = Number(await contract.gameStatus(gameId));
//       if (status == 2) {
//         const game = await contract.games(gameId);

//         if (Number(game.startDate) <= now) {
//           console.log(`[🚀] Game ${gameId} READY. Başlatılıyor...`);

//           const startGameTx = await contract.startGame.populateTransaction(
//             gameId
//           );
//           startGameTx.chainId = 421614;
//           const tx = await privSigner.sendTransaction(startGameTx);
//           const receipt = await tx.wait();

//           console.log(`[✅] Game ${gameId} başlatıldı → TX: ${receipt.hash}`);

//           console.log("Başlatılan oyun detayları:", {
//             game,
//             cardPrice: game.cardPrice,
//             totalCardsSold: game.totalCardsSold,
//             totalPlayerCount: game.totalPlayerCount,
//           });

//           lastSeenReadyId = latest;
//           console.log("En son ready bulunan gameId:", lastSeenReadyId)
//         }
//       }
//     }
//   } catch (err) {
//     console.error(`[START ERROR]`, err.message);
//   }
// }

// async function checkStartedGames() {
//   console.log("🔁 CREATED, READY or STARTED Games Scanning...");

//   await tryStartReadyGames();

//   try {
//     const latest = Number(await contract.gameCounter());

//     // Yeni oyun kontrolü
//     if (Number(latest) > lastSeenId) {
//       for (let gameId = lastSeenId + 1; gameId <= latest; gameId++) {
//         console.log(`🆕 Yeni oyun tespit edildi → Game ${gameId}`);
//       }
//       lastSeenId = Number(latest);
//     }

//     for (let gameId = 1; gameId <= latest; gameId++) {
//       const status = Number(await contract.gameStatus(gameId));
//       if (
//         status == 3 &&
//         !activeReveals.has(gameId) &&
//         !endedGames.has(gameId)
//       ) {
//         console.log(`[🟡] Game ${gameId} STARTED. Reveal döngüsü başlıyor.`);
//         const game = await contract.games(gameId);
//         console.log("Reveal döngüsü başlatılan oyun detayları:", {
//           game,
//           cardPrice: game.cardPrice,
//           totalCardsSold: game.totalCardsSold,
//           totalPlayerCount: game.totalPlayerCount,
//         });
//         activeReveals.add(gameId);
//         gameStartTimes[gameId] = Date.now();
//         runRevealLoop(gameId);
//       }
//     }
//   } catch (e) {
//     console.error("[❌] checkStartedGames Err:", e.message);
//   }
// }


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
    for (let gameId = 145; gameId <= lastLatestGameId; gameId++) {
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

      if (isEnded === false && status === 3 && !activeReveals.has(gameId)) {
        activeReveals.add(gameId);
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
    console.log("--> revealNum Cycle");
    if (activeReveals.size > 0) {
      activeReveals.forEach(async (_gameId) => {
        const success = await revealNum(_gameId, 0);
        if (!success) {
          console.log(
            `[✘] Game ${_gameId} → 3 deneme başarısız. Geçici olarak durduruldu.`
          );
        }
      });
    }
  }, REVEAL_INTERVAL_MS);
})();

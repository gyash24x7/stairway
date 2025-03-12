
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 6.4.1
 * Query Engine version: a9055b89e58b4b5bfb59600785423b1db3d0e75d
 */
Prisma.prismaVersion = {
  client: "6.4.1",
  engine: "a9055b89e58b4b5bfb59600785423b1db3d0e75d"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  name: 'name',
  email: 'email',
  emailVerified: 'emailVerified',
  image: 'image',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SessionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  token: 'token',
  expiresAt: 'expiresAt',
  ipAddress: 'ipAddress',
  userAgent: 'userAgent',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AccountScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  providerId: 'providerId',
  accountId: 'accountId',
  refreshToken: 'refreshToken',
  accessToken: 'accessToken',
  accessTokenExpiresAt: 'accessTokenExpiresAt',
  refreshTokenExpiresAt: 'refreshTokenExpiresAt',
  scope: 'scope',
  idToken: 'idToken',
  password: 'password',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.VerificationScalarFieldEnum = {
  id: 'id',
  identifier: 'identifier',
  value: 'value',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CallBreakGameScalarFieldEnum = {
  id: 'id',
  code: 'code',
  dealCount: 'dealCount',
  trumpSuit: 'trumpSuit',
  status: 'status',
  createdBy: 'createdBy',
  scores: 'scores'
};

exports.Prisma.CallBreakPlayerScalarFieldEnum = {
  id: 'id',
  name: 'name',
  avatar: 'avatar',
  gameId: 'gameId',
  isBot: 'isBot'
};

exports.Prisma.CallBreakDealScalarFieldEnum = {
  id: 'id',
  gameId: 'gameId',
  playerOrder: 'playerOrder',
  declarations: 'declarations',
  wins: 'wins',
  turnIdx: 'turnIdx',
  status: 'status',
  createdAt: 'createdAt'
};

exports.Prisma.CallBreakCardMappingScalarFieldEnum = {
  cardId: 'cardId',
  dealId: 'dealId',
  gameId: 'gameId',
  playerId: 'playerId'
};

exports.Prisma.CallBreakRoundScalarFieldEnum = {
  id: 'id',
  gameId: 'gameId',
  dealId: 'dealId',
  winner: 'winner',
  playerOrder: 'playerOrder',
  cards: 'cards',
  turnIdx: 'turnIdx',
  suit: 'suit',
  completed: 'completed',
  createdAt: 'createdAt'
};

exports.Prisma.LiteraturePlayerScalarFieldEnum = {
  id: 'id',
  name: 'name',
  avatar: 'avatar',
  gameId: 'gameId',
  teamId: 'teamId',
  isBot: 'isBot'
};

exports.Prisma.LiteratureTeamScalarFieldEnum = {
  id: 'id',
  name: 'name',
  score: 'score',
  setsWon: 'setsWon',
  memberIds: 'memberIds',
  gameId: 'gameId'
};

exports.Prisma.LiteratureCardMappingScalarFieldEnum = {
  cardId: 'cardId',
  gameId: 'gameId',
  playerId: 'playerId'
};

exports.Prisma.LiteratureCardLocationScalarFieldEnum = {
  cardId: 'cardId',
  gameId: 'gameId',
  playerId: 'playerId',
  playerIds: 'playerIds',
  weight: 'weight'
};

exports.Prisma.LiteratureAskScalarFieldEnum = {
  id: 'id',
  gameId: 'gameId',
  playerId: 'playerId',
  timestamp: 'timestamp',
  description: 'description',
  success: 'success',
  cardId: 'cardId',
  askedFrom: 'askedFrom'
};

exports.Prisma.LiteratureCallScalarFieldEnum = {
  id: 'id',
  gameId: 'gameId',
  playerId: 'playerId',
  timestamp: 'timestamp',
  description: 'description',
  success: 'success',
  cardSet: 'cardSet',
  actualCall: 'actualCall',
  correctCall: 'correctCall'
};

exports.Prisma.LiteratureTransferScalarFieldEnum = {
  id: 'id',
  gameId: 'gameId',
  playerId: 'playerId',
  timestamp: 'timestamp',
  description: 'description',
  success: 'success',
  transferTo: 'transferTo'
};

exports.Prisma.LiteratureGameScalarFieldEnum = {
  id: 'id',
  code: 'code',
  status: 'status',
  playerCount: 'playerCount',
  currentTurn: 'currentTurn',
  lastMoveId: 'lastMoveId'
};

exports.Prisma.WordleGameScalarFieldEnum = {
  id: 'id',
  playerId: 'playerId',
  wordLength: 'wordLength',
  wordCount: 'wordCount',
  words: 'words',
  guesses: 'guesses',
  completedWords: 'completedWords'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.CallBreakStatus = exports.$Enums.CallBreakStatus = {
  CREATED: 'CREATED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED'
};

exports.LiteratureGameStatus = exports.$Enums.LiteratureGameStatus = {
  CREATED: 'CREATED',
  PLAYERS_READY: 'PLAYERS_READY',
  TEAMS_CREATED: 'TEAMS_CREATED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED'
};

exports.Prisma.ModelName = {
  User: 'User',
  Session: 'Session',
  Account: 'Account',
  Verification: 'Verification',
  CallBreakGame: 'CallBreakGame',
  CallBreakPlayer: 'CallBreakPlayer',
  CallBreakDeal: 'CallBreakDeal',
  CallBreakCardMapping: 'CallBreakCardMapping',
  CallBreakRound: 'CallBreakRound',
  LiteraturePlayer: 'LiteraturePlayer',
  LiteratureTeam: 'LiteratureTeam',
  LiteratureCardMapping: 'LiteratureCardMapping',
  LiteratureCardLocation: 'LiteratureCardLocation',
  LiteratureAsk: 'LiteratureAsk',
  LiteratureCall: 'LiteratureCall',
  LiteratureTransfer: 'LiteratureTransfer',
  LiteratureGame: 'LiteratureGame',
  WordleGame: 'WordleGame'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)

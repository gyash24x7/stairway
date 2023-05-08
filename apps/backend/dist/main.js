/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("tslib");

/***/ }),
/* 2 */
/***/ ((module) => {

module.exports = require("@prisma/client");

/***/ }),
/* 3 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.deserializeUser = exports.requireUser = exports.handleGetLoggedInUser = exports.handleLogout = exports.handleAuthCallback = void 0;
var auth_callback_1 = __webpack_require__(4);
Object.defineProperty(exports, "handleAuthCallback", ({ enumerable: true, get: function () { return __importDefault(auth_callback_1).default; } }));
var logout_1 = __webpack_require__(13);
Object.defineProperty(exports, "handleLogout", ({ enumerable: true, get: function () { return __importDefault(logout_1).default; } }));
var logged_in_user_1 = __webpack_require__(14);
Object.defineProperty(exports, "handleGetLoggedInUser", ({ enumerable: true, get: function () { return __importDefault(logged_in_user_1).default; } }));
var require_user_1 = __webpack_require__(15);
Object.defineProperty(exports, "requireUser", ({ enumerable: true, get: function () { return __importDefault(require_user_1).default; } }));
var deserialize_user_1 = __webpack_require__(16);
Object.defineProperty(exports, "deserializeUser", ({ enumerable: true, get: function () { return __importDefault(deserialize_user_1).default; } }));


/***/ }),
/* 4 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1);
const utils_1 = __webpack_require__(5);
const bcrypt = tslib_1.__importStar(__webpack_require__(8));
const oauth_1 = __webpack_require__(9);
const token_1 = __webpack_require__(11);
function handleAuthCallback(prisma) {
    return async function (req, res) {
        const code = req.query["code"];
        const { access_token, id_token } = await (0, oauth_1.getGoogleToken)(code);
        const { verified_email, email, name, id } = await (0, oauth_1.getGoogleUser)(access_token, id_token);
        if (!verified_email) {
            return res.status(403).send("Google account is not verified");
        }
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            const avatar = `${utils_1.AVATAR_BASE_URL}/${id}.svg?r=50`;
            const salt = await bcrypt.genSalt(10);
            user = await prisma.user.create({
                data: { email, name, avatar, salt }
            });
        }
        const accessToken = (0, token_1.signJwt)(user.id, "access");
        const refreshToken = (0, token_1.signJwt)(user.salt, "refresh");
        res.cookie("accessToken", accessToken, token_1.accessTokenCookieOptions);
        res.cookie("refreshToken", refreshToken, token_1.refreshTokenCookieOptions);
        return res.redirect("http://localhost:5173");
    };
}
exports["default"] = handleAuthCallback;


/***/ }),
/* 5 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1);
tslib_1.__exportStar(__webpack_require__(6), exports);
tslib_1.__exportStar(__webpack_require__(7), exports);


/***/ }),
/* 6 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Publisher = void 0;
class Publisher {
    namespace;
    constructor(namespace) {
        this.namespace = namespace;
    }
    publish(gameData) {
        this.namespace.emit(gameData.id, gameData);
    }
}
exports.Publisher = Publisher;


/***/ }),
/* 7 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GOOGLE_GET_USER_URL = exports.GOOGLE_TOKEN_URL = exports.AVATAR_BASE_URL = void 0;
exports.AVATAR_BASE_URL = "https://avatars.dicebear.com/api/micah";
exports.GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
exports.GOOGLE_GET_USER_URL = "https://www.googleapis.com/oauth2/v1/userinfo";


/***/ }),
/* 8 */
/***/ ((module) => {

module.exports = require("bcryptjs");

/***/ }),
/* 9 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getGoogleUser = exports.getGoogleToken = void 0;
const tslib_1 = __webpack_require__(1);
const utils_1 = __webpack_require__(5);
const axios_1 = tslib_1.__importDefault(__webpack_require__(10));
async function getGoogleToken(code) {
    const url = new URL(utils_1.GOOGLE_TOKEN_URL);
    url.searchParams.append("code", code);
    url.searchParams.append("client_id", process.env["GOOGLE_CLIENT_ID"]);
    url.searchParams.append("client_secret", process.env["GOOGLE_CLIENT_SECRET"]);
    url.searchParams.append("redirect_uri", "http://localhost:8000/api/auth/callback/google");
    url.searchParams.append("grant_type", "authorization_code");
    const res = await axios_1.default.post(url.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });
    return res.data;
}
exports.getGoogleToken = getGoogleToken;
async function getGoogleUser(access_token, id_token) {
    const url = new URL(utils_1.GOOGLE_GET_USER_URL);
    url.searchParams.append("alt", "json");
    url.searchParams.append("access_token", access_token);
    const res = await axios_1.default.get(url.toString(), {
        headers: { Authorization: `Bearer ${id_token}` }
    });
    return res.data;
}
exports.getGoogleUser = getGoogleUser;


/***/ }),
/* 10 */
/***/ ((module) => {

module.exports = require("axios");

/***/ }),
/* 11 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.refreshTokenCookieOptions = exports.accessTokenCookieOptions = exports.reIssueAccessToken = exports.verifyJwt = exports.signJwt = void 0;
const tslib_1 = __webpack_require__(1);
const jsonwebtoken_1 = tslib_1.__importDefault(__webpack_require__(12));
function signJwt(subject, tokenType) {
    const expiresIn = tokenType === "access" ? 15 * 60 : 365 * 24 * 60 * 60;
    return jsonwebtoken_1.default.sign({}, process.env["JWT_SECRET"], { expiresIn, subject });
}
exports.signJwt = signJwt;
function verifyJwt(token) {
    try {
        const payload = jsonwebtoken_1.default.verify(token, process.env["JWT_SECRET"]);
        return { valid: true, expired: false, subject: payload.sub };
    }
    catch (e) {
        console.error(e);
        return { valid: false, expired: e.message === "jwt expired" };
    }
}
exports.verifyJwt = verifyJwt;
async function reIssueAccessToken(refreshToken, prisma) {
    const { subject } = verifyJwt(refreshToken);
    if (!subject) {
        return;
    }
    const user = await prisma.user.findUnique({ where: { salt: subject } });
    if (!user) {
        return;
    }
    return signJwt(user.id, "access");
}
exports.reIssueAccessToken = reIssueAccessToken;
exports.accessTokenCookieOptions = {
    maxAge: 9000000,
    httpOnly: true,
    domain: "localhost",
    path: "/",
    sameSite: "lax",
    secure: false
};
exports.refreshTokenCookieOptions = {
    ...exports.accessTokenCookieOptions,
    maxAge: 3.154e10 // 1 year
};


/***/ }),
/* 12 */
/***/ ((module) => {

module.exports = require("jsonwebtoken");

/***/ }),
/* 13 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const token_1 = __webpack_require__(11);
function handleLogout() {
    return async function (_req, res) {
        res.clearCookie("accessToken", token_1.accessTokenCookieOptions);
        res.clearCookie("refreshToken", token_1.refreshTokenCookieOptions);
        return res.send({});
    };
}
exports["default"] = handleLogout;


/***/ }),
/* 14 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
function getLoggedInUser() {
    return async function (_req, res) {
        const user = res.locals["user"];
        return res.send(user);
    };
}
exports["default"] = getLoggedInUser;


/***/ }),
/* 15 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
function default_1(prisma) {
    return async function (_req, res, next) {
        if (!res.locals["userId"]) {
            return res.sendStatus(403);
        }
        else {
            const user = await prisma.user.findUnique({ where: { id: res.locals["userId"] } });
            if (!user) {
                return res.sendStatus(403);
            }
            res.locals["user"] = user;
            return next();
        }
    };
}
exports["default"] = default_1;


/***/ }),
/* 16 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const token_1 = __webpack_require__(11);
function default_1(prisma) {
    return async function (req, res, next) {
        const authHeader = req.headers.authorization || "";
        const refreshHeader = req.headers["x-refresh"] || "";
        const accessToken = req.cookies["accessToken"] || authHeader.replace(/^Bearer\s/, "");
        const refreshToken = req.cookies["refreshToken"] || refreshHeader;
        if (!accessToken) {
            return next();
        }
        const { subject, expired } = (0, token_1.verifyJwt)(accessToken);
        if (subject) {
            res.locals["userId"] = subject;
            return next();
        }
        if (expired && !!refreshToken) {
            const newAccessToken = await (0, token_1.reIssueAccessToken)(refreshToken, prisma);
            if (!!newAccessToken) {
                res.cookie("accessToken", newAccessToken, token_1.accessTokenCookieOptions);
                const { subject } = (0, token_1.verifyJwt)(newAccessToken);
                res.locals["userId"] = subject;
            }
            return next();
        }
        return next();
    };
}
exports["default"] = default_1;


/***/ }),
/* 17 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.literatureTrpcPanelHandler = exports.literatureExpressHandler = exports.literatureRouter = void 0;
const tslib_1 = __webpack_require__(1);
const dtos_1 = __webpack_require__(18);
const express_1 = __webpack_require__(26);
const trpc_panel_1 = __webpack_require__(27);
const ask_card_1 = tslib_1.__importDefault(__webpack_require__(28));
const call_set_1 = tslib_1.__importDefault(__webpack_require__(31));
const create_game_1 = tslib_1.__importDefault(__webpack_require__(32));
const create_teams_1 = tslib_1.__importDefault(__webpack_require__(38));
const decline_card_1 = tslib_1.__importDefault(__webpack_require__(39));
const get_game_1 = tslib_1.__importDefault(__webpack_require__(40));
const give_card_1 = tslib_1.__importDefault(__webpack_require__(41));
const join_game_1 = tslib_1.__importDefault(__webpack_require__(42));
const start_game_1 = tslib_1.__importDefault(__webpack_require__(43));
const transfer_turn_1 = tslib_1.__importDefault(__webpack_require__(44));
const utils_1 = __webpack_require__(45);
exports.literatureRouter = (0, utils_1.router)({
    createGame: utils_1.procedure.input(dtos_1.createGameInput).mutation(create_game_1.default),
    joinGame: utils_1.procedure.input(dtos_1.joinGameInput).mutation(join_game_1.default),
    createTeams: utils_1.procedureWithGame.input(dtos_1.createTeamsInput).mutation(create_teams_1.default),
    getGame: utils_1.procedureWithGame.input(dtos_1.getGameInput).query(get_game_1.default),
    startGame: utils_1.procedureWithGame.input(dtos_1.startGameInput).mutation(start_game_1.default),
    askCard: utils_1.procedureWithGameInProgress.input(dtos_1.askCardInput).mutation(ask_card_1.default),
    declineCard: utils_1.procedureWithGameInProgress.input(dtos_1.declineCardInput).mutation(decline_card_1.default),
    giveCard: utils_1.procedureWithGameInProgress.input(dtos_1.giveCardInput).mutation(give_card_1.default),
    transferTurn: utils_1.procedureWithGameInProgress.input(dtos_1.transferTurnInput).mutation(transfer_turn_1.default),
    callSet: utils_1.procedureWithGameInProgress.input(dtos_1.callSetInput).mutation(call_set_1.default)
});
function literatureExpressHandler(ctx) {
    return (0, express_1.createExpressMiddleware)({
        router: exports.literatureRouter,
        createContext: ({ res }) => ({ ...ctx, loggedInUser: res.locals["user"] })
    });
}
exports.literatureExpressHandler = literatureExpressHandler;
function literatureTrpcPanelHandler(url) {
    return (0, trpc_panel_1.renderTrpcPanel)(exports.literatureRouter, { url });
}
exports.literatureTrpcPanelHandler = literatureTrpcPanelHandler;


/***/ }),
/* 18 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.transferTurnInput = exports.startGameInput = exports.joinGameInput = exports.giveCardInput = exports.getGameInput = exports.declineCardInput = exports.createTeamsInput = exports.createGameInput = exports.callSetInput = exports.askCardInput = exports.playingCard = void 0;
const tslib_1 = __webpack_require__(1);
const cards_1 = __webpack_require__(19);
const z = tslib_1.__importStar(__webpack_require__(25));
exports.playingCard = z.object({
    rank: z.nativeEnum(cards_1.CardRank),
    suit: z.nativeEnum(cards_1.CardSuit)
});
exports.askCardInput = z.object({
    gameId: z.string().cuid(),
    askedFor: exports.playingCard,
    askedFrom: z.string().cuid()
});
exports.callSetInput = z.object({
    gameId: z.string().cuid(),
    data: z.record(z.string(), z.array(exports.playingCard))
});
exports.createGameInput = z.object({
    playerCount: z.number().int().optional()
});
exports.createTeamsInput = z.object({
    teams: z.string().array().length(2),
    gameId: z.string().cuid()
});
exports.declineCardInput = z.object({
    gameId: z.string().cuid(),
    cardDeclined: exports.playingCard
});
exports.getGameInput = z.object({
    gameId: z.string().cuid()
});
exports.giveCardInput = z.object({
    gameId: z.string().cuid(),
    cardToGive: exports.playingCard,
    giveTo: z.string().cuid()
});
exports.joinGameInput = z.object({
    code: z.string().length(6)
});
exports.startGameInput = exports.getGameInput;
exports.transferTurnInput = exports.getGameInput;


/***/ }),
/* 19 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1);
tslib_1.__exportStar(__webpack_require__(20), exports);
tslib_1.__exportStar(__webpack_require__(22), exports);
tslib_1.__exportStar(__webpack_require__(24), exports);
tslib_1.__exportStar(__webpack_require__(21), exports);


/***/ }),
/* 20 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.cardSetMap = exports.cardSuitMap = exports.SORTED_DECK = exports.CARD_SETS = exports.CARD_SUITS = exports.CARD_RANKS = exports.BIG_CARD_RANKS = exports.SMALL_CARD_RANKS = exports.CardSet = exports.CardSuit = exports.CardRank = void 0;
const playing_card_1 = __webpack_require__(21);
var CardRank;
(function (CardRank) {
    CardRank["ACE"] = "Ace";
    CardRank["TWO"] = "Two";
    CardRank["THREE"] = "Three";
    CardRank["FOUR"] = "Four";
    CardRank["FIVE"] = "Five";
    CardRank["SIX"] = "Six";
    CardRank["SEVEN"] = "Seven";
    CardRank["EIGHT"] = "Eight";
    CardRank["NINE"] = "Nine";
    CardRank["TEN"] = "Ten";
    CardRank["JACK"] = "Jack";
    CardRank["QUEEN"] = "Queen";
    CardRank["KING"] = "King";
})(CardRank = exports.CardRank || (exports.CardRank = {}));
var CardSuit;
(function (CardSuit) {
    CardSuit["HEARTS"] = "Hearts";
    CardSuit["SPADES"] = "Spades";
    CardSuit["CLUBS"] = "Clubs";
    CardSuit["DIAMONDS"] = "Diamonds";
})(CardSuit = exports.CardSuit || (exports.CardSuit = {}));
var CardSet;
(function (CardSet) {
    CardSet["SMALL_DIAMONDS"] = "Small Diamonds";
    CardSet["BIG_DIAMONDS"] = "Big Diamonds";
    CardSet["SMALL_HEARTS"] = "Small Hearts";
    CardSet["BIG_HEARTS"] = "Big Hearts";
    CardSet["SMALL_SPADES"] = "Small Spades";
    CardSet["BIG_SPADES"] = "Big Spades";
    CardSet["SMALL_CLUBS"] = "Small Clubs";
    CardSet["BIG_CLUBS"] = "Big Clubs";
})(CardSet = exports.CardSet || (exports.CardSet = {}));
exports.SMALL_CARD_RANKS = [
    CardRank.ACE,
    CardRank.TWO,
    CardRank.THREE,
    CardRank.FOUR,
    CardRank.FIVE,
    CardRank.SIX
];
exports.BIG_CARD_RANKS = [
    CardRank.SEVEN,
    CardRank.EIGHT,
    CardRank.NINE,
    CardRank.TEN,
    CardRank.JACK,
    CardRank.QUEEN,
    CardRank.KING
];
exports.CARD_RANKS = [
    CardRank.ACE,
    CardRank.TWO,
    CardRank.THREE,
    CardRank.FOUR,
    CardRank.FIVE,
    CardRank.SIX,
    CardRank.SEVEN,
    CardRank.EIGHT,
    CardRank.NINE,
    CardRank.TEN,
    CardRank.JACK,
    CardRank.QUEEN,
    CardRank.KING
];
exports.CARD_SUITS = [CardSuit.HEARTS, CardSuit.CLUBS, CardSuit.DIAMONDS, CardSuit.SPADES];
exports.CARD_SETS = [
    CardSet.BIG_DIAMONDS,
    CardSet.BIG_CLUBS,
    CardSet.BIG_SPADES,
    CardSet.BIG_HEARTS,
    CardSet.SMALL_CLUBS,
    CardSet.SMALL_DIAMONDS,
    CardSet.SMALL_SPADES,
    CardSet.SMALL_HEARTS
];
exports.SORTED_DECK = exports.CARD_SUITS.flatMap(suit => exports.CARD_RANKS.map(rank => playing_card_1.PlayingCard.from({ rank, suit })));
exports.cardSuitMap = {
    [CardSuit.CLUBS]: exports.SORTED_DECK.filter(card => card.suit === CardSuit.CLUBS),
    [CardSuit.SPADES]: exports.SORTED_DECK.filter(card => card.suit === CardSuit.SPADES),
    [CardSuit.HEARTS]: exports.SORTED_DECK.filter(card => card.suit === CardSuit.HEARTS),
    [CardSuit.DIAMONDS]: exports.SORTED_DECK.filter(card => card.suit === CardSuit.DIAMONDS)
};
exports.cardSetMap = {
    [CardSet.SMALL_CLUBS]: exports.cardSuitMap.Clubs.slice(0, 6),
    [CardSet.SMALL_SPADES]: exports.cardSuitMap.Spades.slice(0, 6),
    [CardSet.SMALL_DIAMONDS]: exports.cardSuitMap.Diamonds.slice(0, 6),
    [CardSet.SMALL_HEARTS]: exports.cardSuitMap.Hearts.slice(0, 6),
    [CardSet.BIG_CLUBS]: exports.cardSuitMap.Clubs.slice(7),
    [CardSet.BIG_SPADES]: exports.cardSuitMap.Spades.slice(7),
    [CardSet.BIG_DIAMONDS]: exports.cardSuitMap.Diamonds.slice(7),
    [CardSet.BIG_HEARTS]: exports.cardSuitMap.Hearts.slice(7)
};


/***/ }),
/* 21 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PlayingCard = void 0;
const card_const_1 = __webpack_require__(20);
class PlayingCard {
    rank;
    suit;
    constructor(rank, suit) {
        this.rank = rank;
        this.suit = suit;
    }
    get set() {
        switch (this.suit) {
            case card_const_1.CardSuit.CLUBS:
                return card_const_1.BIG_CARD_RANKS.includes(this.rank) ? card_const_1.CardSet.BIG_CLUBS : card_const_1.CardSet.SMALL_CLUBS;
            case card_const_1.CardSuit.HEARTS:
                return card_const_1.BIG_CARD_RANKS.includes(this.rank) ? card_const_1.CardSet.BIG_HEARTS : card_const_1.CardSet.SMALL_HEARTS;
            case card_const_1.CardSuit.DIAMONDS:
                return card_const_1.BIG_CARD_RANKS.includes(this.rank) ? card_const_1.CardSet.BIG_DIAMONDS : card_const_1.CardSet.SMALL_DIAMONDS;
            case card_const_1.CardSuit.SPADES:
                return card_const_1.BIG_CARD_RANKS.includes(this.rank) ? card_const_1.CardSet.BIG_SPADES : card_const_1.CardSet.SMALL_SPADES;
        }
    }
    get cardString() {
        return `${this.rank} of ${this.suit}`;
    }
    get id() {
        return `${this.rank}Of${this.suit}`;
    }
    static from(card) {
        return new PlayingCard(card.rank, card.suit);
    }
    static fromId(id) {
        const rank = id.split("Of")[0];
        const suit = id.split("Of")[1];
        return new PlayingCard(rank, suit);
    }
    serialize() {
        return JSON.parse(JSON.stringify(this));
    }
}
exports.PlayingCard = PlayingCard;


/***/ }),
/* 22 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CardDeck = void 0;
const lodash_1 = __webpack_require__(23);
const card_const_1 = __webpack_require__(20);
const card_hand_1 = __webpack_require__(24);
class CardDeck {
    cards = (0, lodash_1.shuffle)(card_const_1.SORTED_DECK);
    get length() {
        return this.cards.length;
    }
    removeCardsOfRank(rank) {
        (0, lodash_1.remove)(this.cards, ["rank", rank]);
    }
    generateHands(handCount) {
        if (this.length % handCount !== 0) {
            return [];
        }
        const handSize = this.cards.length / handCount;
        return (0, lodash_1.chunk)(this.cards, handSize).map(cards => card_hand_1.CardHand.from({ cards }));
    }
    sort() {
        this.cards = card_const_1.SORTED_DECK;
    }
}
exports.CardDeck = CardDeck;


/***/ }),
/* 23 */
/***/ ((module) => {

module.exports = require("lodash");

/***/ }),
/* 24 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CardHand = void 0;
const lodash_1 = __webpack_require__(23);
const card_const_1 = __webpack_require__(20);
const playing_card_1 = __webpack_require__(21);
class CardHand {
    cards = [];
    constructor(cards) {
        this.cards = cards.map(playing_card_1.PlayingCard.from);
    }
    get length() {
        return this.cards.length;
    }
    get cardSetsInHand() {
        return (0, lodash_1.uniq)(this.cards.map(card => card.set));
    }
    get cardSuitsInHand() {
        return (0, lodash_1.uniq)(this.cards.map(card => card.suit));
    }
    get ids() {
        return this.cards.map(c => c.id);
    }
    static from(hand) {
        return new CardHand(hand.cards);
    }
    contains(card) {
        return (0, lodash_1.includes)(this.ids, card.id);
    }
    containsAll(cards) {
        return (0, lodash_1.intersection)(cards.map(c => c.id), this.ids).length === cards.length;
    }
    containsSome(cards) {
        return (0, lodash_1.intersection)(cards.map(c => c.id), this.ids).length > 0;
    }
    sorted() {
        return new CardHand((0, lodash_1.intersection)(card_const_1.SORTED_DECK.map(c => c.id), this.ids)
            .map(playing_card_1.PlayingCard.fromId));
    }
    map(fn) {
        return this.cards.map(fn);
    }
    removeCard(card) {
        const ids = this.ids;
        (0, lodash_1.pull)(ids, card.id);
        this.cards = ids.map(playing_card_1.PlayingCard.fromId);
    }
    removeCardsOfSet(cardSet) {
        (0, lodash_1.remove)(this.cards, ["set", cardSet]);
    }
    addCard(...cards) {
        this.cards.push(...cards);
    }
    getCardsOfSet(set) {
        return (0, lodash_1.filter)(this.cards, ["set", set]);
    }
    get(index) {
        return this.cards[index];
    }
    serialize() {
        return JSON.parse(JSON.stringify(this));
    }
}
exports.CardHand = CardHand;


/***/ }),
/* 25 */
/***/ ((module) => {

module.exports = require("zod");

/***/ }),
/* 26 */
/***/ ((module) => {

module.exports = require("@trpc/server/adapters/express");

/***/ }),
/* 27 */
/***/ ((module) => {

module.exports = require("trpc-panel");

/***/ }),
/* 28 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const client_1 = __webpack_require__(2);
const cards_1 = __webpack_require__(19);
const server_1 = __webpack_require__(29);
const constants_1 = __webpack_require__(30);
function validate(ctx, input) {
    if (!ctx.currentGame.playerData[input.askedFrom]) {
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.PLAYER_NOT_FOUND });
    }
    if (ctx.currentGame.myTeam.id === ctx.currentGame.playerData[input.askedFrom].teamId) {
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.CANNOT_ASK_FROM_YOUR_TEAM });
    }
    const askedCard = cards_1.PlayingCard.from(input.askedFor);
    if (ctx.currentGame.loggedInPlayer.hand.contains(askedCard)) {
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.CANNOT_ASK_CARD_THAT_YOU_HAVE });
    }
    return [ctx.currentGame, askedCard];
}
async function default_1({ input, ctx }) {
    const [game, askedCard] = validate(ctx, input);
    const askMove = await ctx.prisma.litMove.create({
        data: game.getNewMoveData({
            type: client_1.LitMoveType.ASK,
            askedFor: askedCard,
            askedFrom: game.playerData[input.askedFrom],
            askedBy: game.loggedInPlayer
        })
    });
    game.addMove(askMove);
    ctx.litGamePublisher.publish(game);
    return game;
}
exports["default"] = default_1;
;


/***/ }),
/* 29 */
/***/ ((module) => {

module.exports = require("@trpc/server");

/***/ }),
/* 30 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Messages = void 0;
exports.Messages = {
    DUPLICATES_IN_CALL: "You cannot call same card to be with multiple players!",
    INVALID_CALL: "You need to declare your cards in the call!",
    CANNOT_CALL_SET_THAT_YOU_DONT_HAVE: "You can only call sets that you have!",
    CANNOT_ASK_CARD_THAT_YOU_HAVE: "You cannot ask a card that you already have!",
    CANNOT_GIVE_CARD_WITHIN_YOUR_TEAM: "You cannot give card to your own team member!",
    CANNOT_ASK_FROM_YOUR_TEAM: "You cannot ask from your team members!",
    INVALID_GAME_ID: "Invalid Game ID!",
    USER_NOT_LOGGED_IN: "User not logged in!",
    INVALID_GAME_STATUS: "Game is in Invalid State!",
    GAME_NOT_FOUND: "Game Not Found!",
    NOT_PART_OF_GAME: "You are not part of the game. Cannot perform action!",
    PLAYER_CAPACITY_FULL: "Game already has required players. Cannot join!",
    NOT_ENOUGH_PLAYERS: "A game needs to have 6 players. Not enough players!",
    PLAYER_NOT_FOUND: "Player not found!",
    INVALID_GIVE_CARD: "You cannot give a card that you don't have!",
    INVALID_DECLINE_CARD: "You cannot decline a card that you have!",
    CALL_ALL_CARDS: "Select all cards of the set to call!",
    CALL_CARDS_OF_SAME_SET: "All cards don't belong to the same set!",
    CALL_CARDS_OF_MENTIONED_SET: "Cards and Set don't match!",
    CALL_WITHIN_YOUR_TEAM: "You can only call set from within your team!",
    INVALID_TRANSFER: "You can transfer chance only when you don't have cards!"
};


/***/ }),
/* 31 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const client_1 = __webpack_require__(2);
const cards_1 = __webpack_require__(19);
const server_1 = __webpack_require__(29);
const constants_1 = __webpack_require__(30);
function validate(ctx, input) {
    const calledCards = Object.values(input.data).flat().map(cards_1.PlayingCard.from);
    const calledCardIds = new Set(calledCards.map(card => card.id));
    const cardSets = new Set(calledCards.map(card => card.set));
    const calledPlayers = Object.keys(input.data).map(playerId => {
        const player = ctx.currentGame.playerData[playerId];
        if (!player) {
            throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.PLAYER_NOT_FOUND });
        }
        return player;
    });
    if (!Object.keys(input.data).includes(ctx.currentGame.loggedInPlayer.id)) {
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.INVALID_CALL });
    }
    if (calledCardIds.size !== calledCards.length) {
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.DUPLICATES_IN_CALL });
    }
    if (cardSets.size !== 1) {
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.CALL_CARDS_OF_SAME_SET });
    }
    const [callingSet] = cardSets;
    if (!ctx.currentGame.loggedInPlayer.hand.cardSetsInHand.includes(callingSet)) {
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.CANNOT_CALL_SET_THAT_YOU_DONT_HAVE });
    }
    const calledTeamIds = new Set(calledPlayers.map(player => player.teamId));
    if (calledTeamIds.size !== 1) {
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.CALL_WITHIN_YOUR_TEAM });
    }
    if (calledCards.length !== 6) {
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.CALL_ALL_CARDS });
    }
    return [ctx.currentGame, callingSet];
}
async function default_1({ input, ctx }) {
    const [game, callingSet] = validate(ctx, input);
    let cardsCalledCorrect = 0;
    game.myTeam.members.forEach(({ id, hand }) => {
        const cardsCalledForPlayer = input.data[id]?.map(cards_1.PlayingCard.from);
        if (!!cardsCalledForPlayer) {
            if (hand.containsAll(cardsCalledForPlayer)) {
                cardsCalledCorrect += cardsCalledForPlayer.length;
            }
        }
    });
    if (cardsCalledCorrect === 6) {
        const myTeam = await ctx.prisma.litTeam.update({
            where: { id: game.loggedInPlayer.teamId },
            data: { score: { increment: 1 } }
        });
        game.handleTeamUpdate(myTeam);
        const callSuccessMove = await ctx.prisma.litMove.create({
            data: game.getNewMoveData({
                type: client_1.LitMoveType.CALL_SUCCESS,
                turnPlayer: game.loggedInPlayer,
                cardSet: callingSet
            })
        });
        game.addMove(callSuccessMove);
    }
    else {
        const oppositeTeam = await ctx.prisma.litTeam.update({
            where: { id: game.oppositeTeam.members[0].teamId },
            data: { score: { increment: 1 } }
        });
        game.handleTeamUpdate(oppositeTeam);
        const callFailMove = await ctx.prisma.litMove.create({
            data: game.getNewMoveData({
                type: client_1.LitMoveType.CALL_FAIL,
                turnPlayer: game.oppositeTeam.membersWithCards[0],
                cardSet: callingSet,
                callingPlayer: game.loggedInPlayer
            })
        });
        game.addMove(callFailMove);
    }
    const handData = game.removeCardsOfSetFromGameAndGetUpdatedHands(callingSet);
    const updatedPlayers = await Promise.all(Object.keys(handData).map(playerId => ctx.prisma.litPlayer.update({
        where: { id: playerId },
        data: { hand: handData[playerId].serialize() }
    })));
    game.handlePlayerUpdate(...updatedPlayers);
    ctx.litGamePublisher.publish(game);
    return game;
}
exports["default"] = default_1;
;


/***/ }),
/* 32 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const utils_1 = __webpack_require__(33);
async function default_1({ ctx, input }) {
    const game = await ctx.prisma.litGame.create({
        data: utils_1.EnhancedLitGame.generateNewGameData({
            playerCount: input.playerCount,
            createdBy: ctx.loggedInUser
        })
    });
    const enhancedGame = utils_1.EnhancedLitGame.from({ ...game, moves: [], teams: [], players: [] });
    const player = await ctx.prisma.litPlayer.create({
        data: enhancedGame.generateNewPlayerData(ctx.loggedInUser)
    });
    enhancedGame.addPlayer(player);
    return enhancedGame;
}
exports["default"] = default_1;
;


/***/ }),
/* 33 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1);
tslib_1.__exportStar(__webpack_require__(34), exports);
tslib_1.__exportStar(__webpack_require__(36), exports);
tslib_1.__exportStar(__webpack_require__(35), exports);
tslib_1.__exportStar(__webpack_require__(37), exports);


/***/ }),
/* 34 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.EnhancedLitGame = void 0;
const client_1 = __webpack_require__(2);
const cards_1 = __webpack_require__(19);
const enhanced_move_1 = __webpack_require__(35);
const enhanced_player_1 = __webpack_require__(36);
const enhanced_team_1 = __webpack_require__(37);
class EnhancedLitGame {
    id;
    code;
    playerCount;
    createdById;
    createdAt;
    updatedAt;
    status;
    players;
    teams;
    moves;
    creator;
    playerData;
    teamData;
    loggedInUserId;
    constructor(game) {
        this.id = game.id;
        this.code = game.code;
        this.playerCount = game.playerCount;
        this.createdById = game.createdById;
        this.createdAt = game.createdAt;
        this.updatedAt = game.updatedAt;
        this.status = game.status;
        this.players = game.players.map(player => new enhanced_player_1.EnhancedLitPlayer(player));
        this.teams = game.teams.map(team => new enhanced_team_1.EnhancedLitTeam(team));
        this.moves = game.moves.map(move => new enhanced_move_1.EnhancedLitMove(move));
        this.creator = this.players.find(player => player.userId === this.createdById);
        this.playerData = {};
        this.players.forEach(player => {
            this.playerData[player.id] = player;
        });
        this.teamData = {};
        this.teams.forEach(team => {
            this.teamData[team.id] = team;
        });
    }
    get loggedInPlayer() {
        return this.players.find(player => player.userId === this.loggedInUserId);
    }
    get askableCardSets() {
        const hand = this.loggedInPlayer?.hand || cards_1.CardHand.from({ cards: [] });
        return hand.cardSetsInHand.filter(cardSet => hand.getCardsOfSet(cardSet).length < 6);
    }
    get callableCardSets() {
        const hand = this.loggedInPlayer?.hand || cards_1.CardHand.from({ cards: [] });
        return hand.cardSetsInHand.filter(cardSet => hand.getCardsOfSet(cardSet).length <= 6);
    }
    get myTeam() {
        if (!this.loggedInPlayer?.teamId) {
            return null;
        }
        return this.teamData[this.loggedInPlayer.teamId];
    }
    get oppositeTeam() {
        if (!this.loggedInPlayer?.teamId) {
            return null;
        }
        return this.teams[0].id !== this.loggedInPlayer.teamId ? this.teams[0] : this.teams[1];
    }
    static from(gameData) {
        const players = gameData.players.map(enhanced_player_1.EnhancedLitPlayer.from);
        const teams = gameData.teams.map(team => {
            const enhancedTeam = enhanced_team_1.EnhancedLitTeam.from(team);
            enhancedTeam.addMembers(players);
            return enhancedTeam;
        });
        const moves = gameData.moves.map(enhanced_move_1.EnhancedLitMove.from)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return new EnhancedLitGame({ ...gameData, players, teams, moves });
    }
    static generateGameCode() {
        const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let result = "";
        for (let i = 0; i < 6; i++) {
            result += chars[Math.floor(Math.random() * 36)];
        }
        return result;
    }
    static generateNewGameData({ playerCount, createdBy }) {
        return { createdById: createdBy.id, playerCount, code: EnhancedLitGame.generateGameCode() };
    }
    generateNewPlayerData({ name, avatar, id }) {
        return { name, avatar, userId: id, hand: { cards: [] }, gameId: this.id };
    }
    addPlayer(player) {
        this.playerData[player.id] = enhanced_player_1.EnhancedLitPlayer.from(player);
        this.players = Object.values(this.playerData);
    }
    isUserAlreadyInGame({ id }) {
        return !!this.players.find(player => player.userId === id);
    }
    addTeams(teams) {
        teams.forEach(team => {
            this.teamData[team.id] = enhanced_team_1.EnhancedLitTeam.from(team);
        });
        this.teams = Object.values(this.teamData);
    }
    dealCardsAndGetHands() {
        const deck = new cards_1.CardDeck();
        deck.removeCardsOfRank(cards_1.CardRank.SEVEN);
        const hands = deck.generateHands(this.playerCount);
        const handData = {};
        this.players.forEach((player, i) => {
            handData[player.id] = hands[i];
        });
        return handData;
    }
    addMove(move) {
        this.moves = [enhanced_move_1.EnhancedLitMove.from(move), ...this.moves];
    }
    getNewMoveData(data) {
        switch (data.type) {
            case client_1.LitMoveType.ASK:
                const { askedFrom, askedBy, askedFor } = data;
                return {
                    gameId: this.id,
                    type: client_1.LitMoveType.ASK,
                    description: `${askedBy.name} asked for ${askedFor.cardString} from ${askedFrom.name}`,
                    askedFor: askedFor.serialize(),
                    askedFromId: askedFrom.id,
                    askedById: askedBy.id
                };
            case client_1.LitMoveType.GIVEN: {
                const { givingPlayer, takingPlayer, card } = data;
                return {
                    gameId: this.id,
                    type: client_1.LitMoveType.GIVEN,
                    turnId: takingPlayer.id,
                    description: `${givingPlayer.name} gave ${card.cardString} to ${takingPlayer.name}`
                };
            }
            case client_1.LitMoveType.TURN: {
                const { turnPlayer } = data;
                return {
                    gameId: this.id,
                    type: client_1.LitMoveType.TURN,
                    turnId: turnPlayer.id,
                    description: `Waiting for ${turnPlayer.name} to Ask or Call`
                };
            }
            case client_1.LitMoveType.DECLINED: {
                const { askingPlayer, declinedPlayer, card } = data;
                return {
                    gameId: this.id,
                    type: client_1.LitMoveType.DECLINED,
                    turnId: declinedPlayer.id,
                    description: `${declinedPlayer.name} declined ${askingPlayer.name}'s ask for ${card.cardString}`
                };
            }
            case client_1.LitMoveType.CALL_SUCCESS: {
                const { turnPlayer, cardSet } = data;
                return {
                    gameId: this.id,
                    type: client_1.LitMoveType.CALL_SUCCESS,
                    turnId: turnPlayer.id,
                    description: `${turnPlayer.name} called ${cardSet} correctly`
                };
            }
            case client_1.LitMoveType.CALL_FAIL: {
                const { turnPlayer, cardSet, callingPlayer } = data;
                return {
                    gameId: this.id,
                    type: client_1.LitMoveType.CALL_FAIL,
                    turnId: turnPlayer.id,
                    description: `${callingPlayer.name} called ${cardSet} incorrectly. ${turnPlayer.name}'s turn`
                };
            }
        }
    }
    handlePlayerUpdate(...players) {
        players.forEach(player => {
            this.playerData[player.id] = enhanced_player_1.EnhancedLitPlayer.from(player);
        });
        this.players = Object.values(this.playerData);
        this.updateTeams();
    }
    removeCardsOfSetFromGameAndGetUpdatedHands(cardSet) {
        const handData = {};
        const cardsCalled = cards_1.cardSetMap[cardSet];
        this.players.forEach(player => {
            if (player.hand.containsSome(cardsCalled)) {
                player.hand.removeCardsOfSet(cardSet);
                handData[player.id] = player.hand;
            }
        });
        return handData;
    }
    handleTeamUpdate(...teams) {
        teams.forEach(team => {
            this.teamData[team.id] = enhanced_team_1.EnhancedLitTeam.from(team);
            this.teamData[team.id].addMembers(this.players);
        });
        this.teams = Object.values(this.teamData);
    }
    updateTeams() {
        Object.keys(this.teamData).map(teamId => {
            this.teamData[teamId].members = this.players.filter(player => player.teamId === teamId);
        });
        this.teams = Object.values(this.teamData);
    }
}
exports.EnhancedLitGame = EnhancedLitGame;


/***/ }),
/* 35 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.EnhancedLitMove = void 0;
const cards_1 = __webpack_require__(19);
class EnhancedLitMove {
    id;
    type;
    description;
    turnId;
    askedFromId;
    askedById;
    gameId;
    createdAt;
    askedFor;
    constructor(move) {
        this.id = move.id;
        this.type = move.type;
        this.description = move.description;
        this.turnId = move.turnId;
        this.askedFromId = move.askedFromId;
        this.askedById = move.askedById;
        this.gameId = move.gameId;
        this.createdAt = move.createdAt;
        this.askedFor = !!move.askedFor ? cards_1.PlayingCard.from(move.askedFor) : null;
    }
    static from(move) {
        return new EnhancedLitMove({
            ...move,
            askedFor: !!move.askedFor ? cards_1.PlayingCard.from(move.askedFor) : null
        });
    }
}
exports.EnhancedLitMove = EnhancedLitMove;


/***/ }),
/* 36 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.EnhancedLitPlayer = void 0;
const cards_1 = __webpack_require__(19);
class EnhancedLitPlayer {
    id;
    name;
    avatar;
    userId;
    gameId;
    teamId;
    hand;
    constructor(player) {
        this.id = player.id;
        this.name = player.name;
        this.avatar = player.avatar;
        this.userId = player.userId;
        this.gameId = player.gameId;
        this.teamId = player.teamId;
        this.hand = cards_1.CardHand.from(player.hand);
    }
    static from(player) {
        return new EnhancedLitPlayer({
            ...player,
            hand: cards_1.CardHand.from(player.hand)
        });
    }
}
exports.EnhancedLitPlayer = EnhancedLitPlayer;


/***/ }),
/* 37 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.EnhancedLitTeam = void 0;
const enhanced_player_1 = __webpack_require__(36);
class EnhancedLitTeam {
    id;
    name;
    score;
    gameId;
    members;
    constructor(team) {
        this.id = team.id;
        this.name = team.name;
        this.score = team.score;
        this.gameId = team.gameId;
        this.members = team.members.map(member => new enhanced_player_1.EnhancedLitPlayer(member));
    }
    get membersWithCards() {
        return this.members.filter(member => member.hand.length > 0);
    }
    static from(litTeam) {
        return new EnhancedLitTeam({ ...litTeam, members: [] });
    }
    addMembers(players) {
        this.members = players.filter(player => player.teamId === this.id);
    }
}
exports.EnhancedLitTeam = EnhancedLitTeam;


/***/ }),
/* 38 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const client_1 = __webpack_require__(2);
const server_1 = __webpack_require__(29);
const lodash_1 = __webpack_require__(23);
const constants_1 = __webpack_require__(30);
function validate(ctx) {
    if (ctx.currentGame.status !== client_1.LitGameStatus.PLAYERS_READY) {
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.INVALID_GAME_STATUS });
    }
    if (ctx.currentGame.players.length !== ctx.currentGame.playerCount) {
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.NOT_ENOUGH_PLAYERS });
    }
    return [ctx.currentGame];
}
async function default_1({ input, ctx }) {
    const [game] = validate(ctx);
    const teams = await Promise.all(input.teams.map(name => ctx.prisma.litTeam.create({ data: { name, gameId: game.id } })));
    game.addTeams(teams);
    const players = await Promise.all((0, lodash_1.shuffle)(game.players).map((player, i) => ctx.prisma.litPlayer.update({
        where: { id: player.id },
        data: { teamId: teams[i % 2].id }
    })));
    game.handlePlayerUpdate(...players);
    await ctx.prisma.litGame.update({
        where: { id: game.id },
        data: { status: client_1.LitGameStatus.TEAMS_CREATED }
    });
    game.status = client_1.LitGameStatus.TEAMS_CREATED;
    ctx.litGamePublisher.publish(game);
    return game;
}
exports["default"] = default_1;
;


/***/ }),
/* 39 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const client_1 = __webpack_require__(2);
const cards_1 = __webpack_require__(19);
const server_1 = __webpack_require__(29);
const constants_1 = __webpack_require__(30);
function validate(ctx, input) {
    const cardDeclined = cards_1.PlayingCard.from(input.cardDeclined);
    if (ctx.currentGame.loggedInPlayer.hand.contains(cardDeclined)) {
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.INVALID_DECLINE_CARD });
    }
    return [ctx.currentGame, cardDeclined];
}
async function default_1({ ctx, input }) {
    const [game, cardDeclined] = validate(ctx, input);
    const declineMove = await ctx.prisma.litMove.create({
        data: game.getNewMoveData({
            type: client_1.LitMoveType.DECLINED,
            declinedPlayer: game.loggedInPlayer,
            askingPlayer: game.playerData[game.moves[0].askedById],
            card: cardDeclined
        })
    });
    game.addMove(declineMove);
    ctx.litGamePublisher.publish(game);
    return game;
}
exports["default"] = default_1;
;


/***/ }),
/* 40 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
async function default_1({ ctx }) {
    return ctx.currentGame;
}
exports["default"] = default_1;
;


/***/ }),
/* 41 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const client_1 = __webpack_require__(2);
const cards_1 = __webpack_require__(19);
const server_1 = __webpack_require__(29);
const constants_1 = __webpack_require__(30);
function validate(ctx, input) {
    const cardToGive = cards_1.PlayingCard.from(input.cardToGive);
    const givingPlayer = ctx.currentGame.loggedInPlayer;
    const takingPlayer = ctx.currentGame.playerData[input.giveTo];
    if (!takingPlayer) {
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.PLAYER_NOT_FOUND });
    }
    if (takingPlayer.teamId === givingPlayer.teamId) {
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.CANNOT_GIVE_CARD_WITHIN_YOUR_TEAM });
    }
    if (!givingPlayer.hand.contains(cardToGive)) {
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.INVALID_GIVE_CARD });
    }
    return [ctx.currentGame, givingPlayer, takingPlayer, cardToGive];
}
async function default_1({ input, ctx }) {
    const [game, givingPlayer, takingPlayer, cardToGive] = validate(ctx, input);
    givingPlayer.hand.removeCard(cardToGive);
    takingPlayer.hand.addCard(cardToGive);
    const updatedPlayers = await Promise.all([
        ctx.prisma.litPlayer.update({
            where: { id: givingPlayer.id },
            data: { hand: givingPlayer.hand.serialize() }
        }),
        ctx.prisma.litPlayer.update({
            where: { id: takingPlayer.id },
            data: { hand: takingPlayer.hand.serialize() }
        })
    ]);
    game.handlePlayerUpdate(...updatedPlayers);
    const giveCardMove = await ctx.prisma.litMove.create({
        data: game.getNewMoveData({ type: client_1.LitMoveType.GIVEN, takingPlayer, givingPlayer, card: cardToGive })
    });
    game.addMove(giveCardMove);
    ctx.litGamePublisher.publish(game);
    return game;
}
exports["default"] = default_1;
;


/***/ }),
/* 42 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const client_1 = __webpack_require__(2);
const utils_1 = __webpack_require__(33);
const server_1 = __webpack_require__(29);
const constants_1 = __webpack_require__(30);
async function validate(ctx, input) {
    const game = await ctx.prisma.litGame.findFirst({
        where: { code: input.code },
        include: { players: true }
    });
    if (!game) {
        throw new server_1.TRPCError({ code: "NOT_FOUND", message: constants_1.Messages.GAME_NOT_FOUND });
    }
    const enhancedGame = utils_1.EnhancedLitGame.from({ ...game, moves: [], teams: [] });
    if (game.players.length >= game.playerCount) {
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.PLAYER_CAPACITY_FULL });
    }
    return enhancedGame;
}
async function default_1({ ctx, input }) {
    const game = await validate(ctx, input);
    if (game.isUserAlreadyInGame(ctx.loggedInUser)) {
        return game;
    }
    const player = await ctx.prisma.litPlayer.create({
        data: game.generateNewPlayerData(ctx.loggedInUser)
    });
    game.addPlayer(player);
    game.status = game.players.length === game.playerCount
        ? client_1.LitGameStatus.PLAYERS_READY
        : client_1.LitGameStatus.NOT_STARTED;
    await ctx.prisma.litGame.update({
        where: { id: game.id },
        data: { status: game.status }
    });
    ctx.litGamePublisher.publish(game);
    return game;
}
exports["default"] = default_1;
;


/***/ }),
/* 43 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const client_1 = __webpack_require__(2);
const server_1 = __webpack_require__(29);
const constants_1 = __webpack_require__(30);
function validate(ctx) {
    if (ctx.currentGame.status !== client_1.LitGameStatus.TEAMS_CREATED) {
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.INVALID_GAME_STATUS });
    }
    return [ctx.currentGame];
}
async function default_1({ input, ctx }) {
    const [game] = validate(ctx);
    const handData = game.dealCardsAndGetHands();
    const updatedPlayers = await Promise.all(game.players.map(player => ctx.prisma.litPlayer.update({
        where: { id: player.id },
        data: { hand: handData[player.id].serialize() }
    })));
    game.handlePlayerUpdate(...updatedPlayers);
    const firstMove = await ctx.prisma.litMove.create({
        data: game.getNewMoveData({
            type: client_1.LitMoveType.TURN,
            turnPlayer: game.loggedInPlayer
        })
    });
    game.addMove(firstMove);
    await ctx.prisma.litGame.update({
        where: { id: input.gameId },
        data: { status: client_1.LitGameStatus.IN_PROGRESS }
    });
    game.status = client_1.LitGameStatus.IN_PROGRESS;
    ctx.litGamePublisher.publish(game);
    return game;
}
exports["default"] = default_1;
;


/***/ }),
/* 44 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const client_1 = __webpack_require__(2);
const server_1 = __webpack_require__(29);
const constants_1 = __webpack_require__(30);
function validate(ctx) {
    if (ctx.currentGame.loggedInPlayer.hand.length !== 0) {
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.INVALID_TRANSFER });
    }
    return [ctx.currentGame];
}
async function default_1({ input, ctx }) {
    const [game] = validate(ctx);
    if (game.myTeam.membersWithCards.length === 0 && game.oppositeTeam.membersWithCards.length === 0) {
        await ctx.prisma.litGame.update({
            where: { id: input.gameId },
            data: { status: client_1.LitGameStatus.COMPLETED }
        });
        game.status = client_1.LitGameStatus.COMPLETED;
        ctx.litGamePublisher.publish(game);
        return game;
    }
    const nextPlayer = game.myTeam.membersWithCards.length === 0
        ? game.oppositeTeam.membersWithCards[0]
        : game.myTeam.membersWithCards[0];
    const transferTurnMove = await ctx.prisma.litMove.create({
        data: game.getNewMoveData({ type: client_1.LitMoveType.TURN, turnPlayer: nextPlayer })
    });
    game.addMove(transferTurnMove);
    ctx.litGamePublisher.publish(game);
    return game;
}
exports["default"] = default_1;
;


/***/ }),
/* 45 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.procedureWithGameInProgress = exports.procedureWithGame = exports.procedure = exports.router = exports.t = void 0;
const tslib_1 = __webpack_require__(1);
const trpc = tslib_1.__importStar(__webpack_require__(29));
const superjson_1 = tslib_1.__importDefault(__webpack_require__(46));
const require_game_1 = tslib_1.__importDefault(__webpack_require__(47));
const require_game_in_progress_1 = tslib_1.__importDefault(__webpack_require__(48));
const require_player_1 = tslib_1.__importDefault(__webpack_require__(49));
exports.t = trpc.initTRPC.context().create({ transformer: superjson_1.default });
exports.router = exports.t.router;
exports.procedure = exports.t.procedure;
exports.procedureWithGame = exports.t.procedure.use(require_game_1.default).use(require_player_1.default);
exports.procedureWithGameInProgress = exports.procedureWithGame.use(require_game_in_progress_1.default);


/***/ }),
/* 46 */
/***/ ((module) => {

module.exports = require("superjson");

/***/ }),
/* 47 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.requireGame = void 0;
const dtos_1 = __webpack_require__(18);
const utils_1 = __webpack_require__(33);
const server_1 = __webpack_require__(29);
const constants_1 = __webpack_require__(30);
const requireGame = async function ({ ctx, rawInput, next }) {
    const result = dtos_1.getGameInput.safeParse(rawInput);
    if (!result.success) {
        console.error(result.error);
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.INVALID_GAME_ID });
    }
    const game = await ctx.prisma.litGame.findUnique({
        where: { id: result.data.gameId },
        include: { players: true, moves: true, teams: true }
    });
    if (!game) {
        throw new server_1.TRPCError({ code: "NOT_FOUND", message: constants_1.Messages.GAME_NOT_FOUND });
    }
    const currentGame = utils_1.EnhancedLitGame.from(game);
    return next({ ctx: { ...ctx, currentGame } });
};
exports.requireGame = requireGame;
exports["default"] = exports.requireGame;


/***/ }),
/* 48 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const client_1 = __webpack_require__(2);
const server_1 = __webpack_require__(29);
const constants_1 = __webpack_require__(30);
const requireGameInProgress = async ({ ctx, next }) => {
    if (!ctx.currentGame) {
        throw new server_1.TRPCError({ code: "NOT_FOUND", message: constants_1.Messages.GAME_NOT_FOUND });
    }
    if (ctx.currentGame.status !== client_1.LitGameStatus.IN_PROGRESS) {
        throw new server_1.TRPCError({ code: "BAD_REQUEST", message: constants_1.Messages.INVALID_GAME_STATUS });
    }
    return next({ ctx });
};
exports["default"] = requireGameInProgress;


/***/ }),
/* 49 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const server_1 = __webpack_require__(29);
const constants_1 = __webpack_require__(30);
const requirePlayer = async ({ ctx, next }) => {
    if (!ctx.loggedInUser) {
        throw new server_1.TRPCError({ code: "UNAUTHORIZED", message: constants_1.Messages.USER_NOT_LOGGED_IN });
    }
    if (!ctx.currentGame) {
        throw new server_1.TRPCError({ code: "NOT_FOUND", message: constants_1.Messages.GAME_NOT_FOUND });
    }
    ctx.currentGame.loggedInUserId = ctx.loggedInUser.id;
    if (!ctx.currentGame.loggedInPlayer) {
        throw new server_1.TRPCError({ code: "FORBIDDEN", message: constants_1.Messages.NOT_PART_OF_GAME });
    }
    return next({ ctx });
};
exports["default"] = requirePlayer;


/***/ }),
/* 50 */
/***/ ((module) => {

module.exports = require("cookie-parser");

/***/ }),
/* 51 */
/***/ ((module) => {

module.exports = require("cors");

/***/ }),
/* 52 */
/***/ ((module) => {

module.exports = require("dotenv");

/***/ }),
/* 53 */
/***/ ((module) => {

module.exports = require("express");

/***/ }),
/* 54 */
/***/ ((module) => {

module.exports = require("http");

/***/ }),
/* 55 */
/***/ ((module) => {

module.exports = require("morgan");

/***/ }),
/* 56 */
/***/ ((module) => {

module.exports = require("socket.io");

/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1);
const client_1 = __webpack_require__(2);
const auth_1 = __webpack_require__(3);
const router_1 = __webpack_require__(17);
const utils_1 = __webpack_require__(5);
const cookie_parser_1 = tslib_1.__importDefault(__webpack_require__(50));
const cors_1 = tslib_1.__importDefault(__webpack_require__(51));
const dotenv_1 = tslib_1.__importDefault(__webpack_require__(52));
const express_1 = tslib_1.__importDefault(__webpack_require__(53));
const http_1 = tslib_1.__importDefault(__webpack_require__(54));
const morgan_1 = tslib_1.__importDefault(__webpack_require__(55));
const socket_io_1 = __webpack_require__(56);
dotenv_1.default.config();
const port = process.env["PORT"] || 8000;
const prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: ["http://localhost:5173"],
        allowedHeaders: ["Authorization"],
        credentials: true
    }
});
app.use((0, morgan_1.default)("tiny"));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
app.use((0, cors_1.default)({ credentials: true, origin: "http://localhost:5173" }));
app.use((0, auth_1.deserializeUser)(prisma));
const literatureNameSpace = io.of("/literature");
literatureNameSpace.on("connection", socket => {
    console.log("New Client Connected!");
    console.log(`Socket: ${socket.id}`);
    socket.emit("welcome", { message: "Welcome to Literature!" });
    socket.on("disconnect", () => {
        console.log("Client Disconnected!");
        console.log(`Socket: ${socket.id}`);
    });
});
const litGamePublisher = new utils_1.Publisher(literatureNameSpace);
app.get("/api/health", async (_req, res) => {
    return res.send({ healthy: true });
});
app.get("/api/me", (0, auth_1.requireUser)(prisma), (0, auth_1.handleGetLoggedInUser)());
app.delete("/api/auth/logout", (0, auth_1.requireUser)(prisma), (0, auth_1.handleLogout)());
app.get("/api/auth/callback/google", (0, auth_1.handleAuthCallback)(prisma));
app.use("/api/literature", [(0, auth_1.requireUser)(prisma), (0, router_1.literatureExpressHandler)({ prisma, litGamePublisher })]);
server.listen(port, () => {
    console.log(`Server started on port ${port}`);
});

})();

var __webpack_export_target__ = exports;
for(var i in __webpack_exports__) __webpack_export_target__[i] = __webpack_exports__[i];
if(__webpack_exports__.__esModule) Object.defineProperty(__webpack_export_target__, "__esModule", { value: true });
/******/ })()
;
//# sourceMappingURL=main.js.map
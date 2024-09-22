/**
 * The config file should ideally be popupated with an env file or similar upon building.
 */

export const network = { regtest : null }; // options: mainnet, testnet, regtest
// must be an https url a tap reader's rest endpoint. On Bitcoin mainnet, the endpoint must be located on a domain with ipv6 SSL support
// for local replicas of ICP, it is recommended to use a tap reader on the web with SSL cert. instead of local instance.
export const API_HOST = '';
// the mint tick can be any tap token mint as of this canister, but it should be a ticker that practically can never mint out.
export const MINT_TICK = 'tapswap-v2';
export const START_BLOCK = 3522;
export const TOKEN_AUTH_INSCRIPTION = '';
export const PRIVILEGE_AUTH_INSCRIPTION = '';
// The btc network to operate on. Options: mainnet, testnet, regtest
export const network = { regtest : null };

// must be an https url a tap reader's rest endpoint. On Bitcoin mainnet, the endpoint must be located on a domain with ipv6 SSL support
// for local replicas of ICP, it is recommended to use a tap reader on the web with SSL cert. instead of local instance.
export const API_HOST = '';

// the mint tick can be any tap token mint as of this canister, but it should be a ticker that practically can never mint out.
// mints can be used as a cheap alternative to transfers to send commands to the canister from within bitcoin (through the dta field).
// it is recommended to deploy a ticker specifically for canister communication that uses a low mint limit and extremel high supply.
// max allowed supply within the tap protocol is 18446744073709551615.
export const MINT_TICK = 'sometokenticker'

// the BTC block to start from listening to events in incoming.ts
export const START_BLOCK = 0;

// the ETH block to start counting from
export const START_ETH_BLOCK = 6795731;

// inscription id of this canister's privilege authority (if used)
export const PRIVILEGE_AUTH_INSCRIPTION = '';

// inscription id of this canister's token authority (if used)
export const TOKEN_AUTH_INSCRIPTION = '';

// the eth chain id (as bigint),
// sepolia: 11155111n
// mainnet: 1n
export const ETH_CHAIN_ID = 11155111n;

// your choice on the eth finality distance. Recommended values from 50 to 114 blocks.
// for testing purposes, you can leave it at zero but make sure to enable in production.
export const ETH_FINALITY_DISTANCE = 0;

// your choice on the btc finality distance. Recommended values from 3 to 12 blocks.
// for testing purposes, you can leave it at zero but make sure to enable in production.
export const BITCOIN_FINALITY_DISTANCE = 0;

// Internal eth_rpc call. Choice of network and providers to use.
// See eth_rpc.ts for all available options.
// For mainnet, use:
//export const ethRpcMulti = {
//    EthMainnet : [
//        [{ PublicNode: null }]
//    ]
//};
export const ethRpcMulti = {
    EthSepolia : [
        [{ PublicNode: null }]
    ]
};

// Internal eth_rpc call. Choice of network and providers to use.
// See eth_rpc.ts for all available options.
// For mainnet, use:
//export const ethRpcSingle = {
//    EthMainnet : { PublicNode: null }
//};
export const ethRpcSingle = {
    EthSepolia : { PublicNode: null }
};
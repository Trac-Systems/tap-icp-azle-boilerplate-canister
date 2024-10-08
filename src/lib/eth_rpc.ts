import {IDL} from "azle";

 export   const Auth = IDL.Variant({
        'RegisterProvider' : IDL.Null,
        'FreeRpc' : IDL.Null,
        'PriorityRpc' : IDL.Null,
        'Manage' : IDL.Null,
    });
 export   const EthSepoliaService = IDL.Variant({
        'Alchemy' : IDL.Null,
        'BlockPi' : IDL.Null,
        'PublicNode' : IDL.Null,
        'Ankr' : IDL.Null,
    });
 export   const L2MainnetService = IDL.Variant({
        'Alchemy' : IDL.Null,
        'BlockPi' : IDL.Null,
        'PublicNode' : IDL.Null,
        'Ankr' : IDL.Null,
    });
 export   const HttpHeader = IDL.Record({ 'value' : IDL.Text, 'name' : IDL.Text });
 export   const RpcApi = IDL.Record({
        'url' : IDL.Text,
        'headers' : IDL.Opt(IDL.Vec(HttpHeader)),
    });
 export   const EthMainnetService = IDL.Variant({
        'Alchemy' : IDL.Null,
        'BlockPi' : IDL.Null,
        'Cloudflare' : IDL.Null,
        'PublicNode' : IDL.Null,
        'Ankr' : IDL.Null,
    });
 export   const RpcServices = IDL.Variant({
        'EthSepolia' : IDL.Opt(IDL.Vec(EthSepoliaService)),
        'BaseMainnet' : IDL.Opt(IDL.Vec(L2MainnetService)),
        'Custom' : IDL.Record({
            'chainId' : IDL.Nat64,
            'services' : IDL.Vec(RpcApi),
        }),
        'OptimismMainnet' : IDL.Opt(IDL.Vec(L2MainnetService)),
        'ArbitrumOne' : IDL.Opt(IDL.Vec(L2MainnetService)),
        'EthMainnet' : IDL.Opt(IDL.Vec(EthMainnetService)),
    });
 export   const RpcConfig = IDL.Record({ 'responseSizeEstimate' : IDL.Opt(IDL.Nat64) });
 export   const BlockTag = IDL.Variant({
        'Earliest' : IDL.Null,
        'Safe' : IDL.Null,
        'Finalized' : IDL.Null,
        'Latest' : IDL.Null,
        'Number' : IDL.Nat,
        'Pending' : IDL.Null,
    });
 export   const FeeHistoryArgs = IDL.Record({
        'blockCount' : IDL.Nat,
        'newestBlock' : BlockTag,
        'rewardPercentiles' : IDL.Opt(IDL.Vec(IDL.Nat8)),
    });
 export   const FeeHistory = IDL.Record({
        'reward' : IDL.Vec(IDL.Vec(IDL.Nat)),
        'gasUsedRatio' : IDL.Vec(IDL.Float64),
        'oldestBlock' : IDL.Nat,
        'baseFeePerGas' : IDL.Vec(IDL.Nat),
    });
 export   const JsonRpcError = IDL.Record({ 'code' : IDL.Int64, 'message' : IDL.Text });
 export   const ProviderError = IDL.Variant({
        'TooFewCycles' : IDL.Record({ 'expected' : IDL.Nat, 'received' : IDL.Nat }),
        'MissingRequiredProvider' : IDL.Null,
        'ProviderNotFound' : IDL.Null,
        'NoPermission' : IDL.Null,
    });
 export   const ValidationError = IDL.Variant({
        'CredentialPathNotAllowed' : IDL.Null,
        'HostNotAllowed' : IDL.Text,
        'CredentialHeaderNotAllowed' : IDL.Null,
        'UrlParseError' : IDL.Text,
        'Custom' : IDL.Text,
        'InvalidHex' : IDL.Text,
    });
 export   const RejectionCode = IDL.Variant({
        'NoError' : IDL.Null,
        'CanisterError' : IDL.Null,
        'SysTransient' : IDL.Null,
        'DestinationInvalid' : IDL.Null,
        'Unknown' : IDL.Null,
        'SysFatal' : IDL.Null,
        'CanisterReject' : IDL.Null,
    });
 export   const HttpOutcallError = IDL.Variant({
        'IcError' : IDL.Record({ 'code' : RejectionCode, 'message' : IDL.Text }),
        'InvalidHttpJsonRpcResponse' : IDL.Record({
            'status' : IDL.Nat16,
            'body' : IDL.Text,
            'parsingError' : IDL.Opt(IDL.Text),
        }),
    });
 export   const RpcError = IDL.Variant({
        'JsonRpcError' : JsonRpcError,
        'ProviderError' : ProviderError,
        'ValidationError' : ValidationError,
        'HttpOutcallError' : HttpOutcallError,
    });
 export   const FeeHistoryResult = IDL.Variant({
        'Ok' : IDL.Opt(FeeHistory),
        'Err' : RpcError,
    });
 export   const RpcService = IDL.Variant({
        'EthSepolia' : EthSepoliaService,
        'BaseMainnet' : L2MainnetService,
        'Custom' : RpcApi,
        'OptimismMainnet' : L2MainnetService,
        'ArbitrumOne' : L2MainnetService,
        'EthMainnet' : EthMainnetService,
        'Chain' : IDL.Nat64,
        'Provider' : IDL.Nat64,
    });
 export   const MultiFeeHistoryResult = IDL.Variant({
        'Consistent' : FeeHistoryResult,
        'Inconsistent' : IDL.Vec(IDL.Tuple(RpcService, FeeHistoryResult)),
    });
 export   const Block = IDL.Record({
        'miner' : IDL.Text,
        'totalDifficulty' : IDL.Nat,
        'receiptsRoot' : IDL.Text,
        'stateRoot' : IDL.Text,
        'hash' : IDL.Text,
        'difficulty' : IDL.Nat,
        'size' : IDL.Nat,
        'uncles' : IDL.Vec(IDL.Text),
        'baseFeePerGas' : IDL.Nat,
        'extraData' : IDL.Text,
        'transactionsRoot' : IDL.Opt(IDL.Text),
        'sha3Uncles' : IDL.Text,
        'nonce' : IDL.Nat,
        'number' : IDL.Nat,
        'timestamp' : IDL.Nat,
        'transactions' : IDL.Vec(IDL.Text),
        'gasLimit' : IDL.Nat,
        'logsBloom' : IDL.Text,
        'parentHash' : IDL.Text,
        'gasUsed' : IDL.Nat,
        'mixHash' : IDL.Text,
    });
 export   const GetBlockByNumberResult = IDL.Variant({
        'Ok' : Block,
        'Err' : RpcError,
    });
 export   const MultiGetBlockByNumberResult = IDL.Variant({
        'Consistent' : GetBlockByNumberResult,
        'Inconsistent' : IDL.Vec(IDL.Tuple(RpcService, GetBlockByNumberResult)),
    });
 export   const Topic = IDL.Vec(IDL.Text);
 export   const GetLogsArgs = IDL.Record({
        'fromBlock' : IDL.Opt(BlockTag),
        'toBlock' : IDL.Opt(BlockTag),
        'addresses' : IDL.Vec(IDL.Text),
        'topics' : IDL.Opt(IDL.Vec(Topic)),
    });
 export   const LogEntry = IDL.Record({
        'transactionHash' : IDL.Opt(IDL.Text),
        'blockNumber' : IDL.Opt(IDL.Nat),
        'data' : IDL.Text,
        'blockHash' : IDL.Opt(IDL.Text),
        'transactionIndex' : IDL.Opt(IDL.Nat),
        'topics' : IDL.Vec(IDL.Text),
        'address' : IDL.Text,
        'logIndex' : IDL.Opt(IDL.Nat),
        'removed' : IDL.Bool,
    });
 export   const GetLogsResult = IDL.Variant({
        'Ok' : IDL.Vec(LogEntry),
        'Err' : RpcError,
    });
 export   const MultiGetLogsResult = IDL.Variant({
        'Consistent' : GetLogsResult,
        'Inconsistent' : IDL.Vec(IDL.Tuple(RpcService, GetLogsResult)),
    });
 export   const GetTransactionCountArgs = IDL.Record({
        'address' : IDL.Text,
        'block' : BlockTag,
    });
 export   const GetTransactionCountResult = IDL.Variant({
        'Ok' : IDL.Nat,
        'Err' : RpcError,
    });
 export   const MultiGetTransactionCountResult = IDL.Variant({
        'Consistent' : GetTransactionCountResult,
        'Inconsistent' : IDL.Vec(IDL.Tuple(RpcService, GetTransactionCountResult)),
    });
 export   const TransactionReceipt = IDL.Record({
        'to' : IDL.Text,
        'status' : IDL.Nat,
        'transactionHash' : IDL.Text,
        'blockNumber' : IDL.Nat,
        'from' : IDL.Text,
        'logs' : IDL.Vec(LogEntry),
        'blockHash' : IDL.Text,
        'type' : IDL.Text,
        'transactionIndex' : IDL.Nat,
        'effectiveGasPrice' : IDL.Nat,
        'logsBloom' : IDL.Text,
        'contractAddress' : IDL.Opt(IDL.Text),
        'gasUsed' : IDL.Nat,
    });
 export   const GetTransactionReceiptResult = IDL.Variant({
        'Ok' : IDL.Opt(TransactionReceipt),
        'Err' : RpcError,
    });
 export   const MultiGetTransactionReceiptResult = IDL.Variant({
        'Consistent' : GetTransactionReceiptResult,
        'Inconsistent' : IDL.Vec(
            IDL.Tuple(RpcService, GetTransactionReceiptResult)
        ),
    });
 export   const SendRawTransactionStatus = IDL.Variant({
        'Ok' : IDL.Opt(IDL.Text),
        'NonceTooLow' : IDL.Null,
        'NonceTooHigh' : IDL.Null,
        'InsufficientFunds' : IDL.Null,
    });
 export   const SendRawTransactionResult = IDL.Variant({
        'Ok' : SendRawTransactionStatus,
        'Err' : RpcError,
    });
 export   const MultiSendRawTransactionResult = IDL.Variant({
        'Consistent' : SendRawTransactionResult,
        'Inconsistent' : IDL.Vec(IDL.Tuple(RpcService, SendRawTransactionResult)),
    });
 export   const ProviderId = IDL.Nat64;
 export   const Metrics = IDL.Record({
        'cyclesWithdrawn' : IDL.Nat,
        'responses' : IDL.Vec(
            IDL.Tuple(IDL.Tuple(IDL.Text, IDL.Text, IDL.Text), IDL.Nat64)
        ),
        'errNoPermission' : IDL.Nat64,
        'inconsistentResponses' : IDL.Vec(
            IDL.Tuple(IDL.Tuple(IDL.Text, IDL.Text), IDL.Nat64)
        ),
        'cyclesCharged' : IDL.Vec(
            IDL.Tuple(IDL.Tuple(IDL.Text, IDL.Text), IDL.Nat)
        ),
        'requests' : IDL.Vec(IDL.Tuple(IDL.Tuple(IDL.Text, IDL.Text), IDL.Nat64)),
        'errHttpOutcall' : IDL.Vec(
            IDL.Tuple(IDL.Tuple(IDL.Text, IDL.Text), IDL.Nat64)
        ),
        'errHostNotAllowed' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Nat64)),
    });
 export   const ProviderView = IDL.Record({
        'cyclesPerCall' : IDL.Nat64,
        'owner' : IDL.Principal,
        'hostname' : IDL.Text,
        'primary' : IDL.Bool,
        'chainId' : IDL.Nat64,
        'cyclesPerMessageByte' : IDL.Nat64,
        'providerId' : IDL.Nat64,
    });
 export   const ManageProviderArgs = IDL.Record({
        'service' : IDL.Opt(RpcService),
        'primary' : IDL.Opt(IDL.Bool),
        'providerId' : IDL.Nat64,
    });
 export   const RegisterProviderArgs = IDL.Record({
        'cyclesPerCall' : IDL.Nat64,
        'credentialPath' : IDL.Text,
        'hostname' : IDL.Text,
        'credentialHeaders' : IDL.Opt(IDL.Vec(HttpHeader)),
        'chainId' : IDL.Nat64,
        'cyclesPerMessageByte' : IDL.Nat64,
    });
 export   const RequestResult = IDL.Variant({ 'Ok' : IDL.Text, 'Err' : RpcError });
 export   const RequestCostResult = IDL.Variant({ 'Ok' : IDL.Nat, 'Err' : RpcError });
 export   const UpdateProviderArgs = IDL.Record({
        'cyclesPerCall' : IDL.Opt(IDL.Nat64),
        'credentialPath' : IDL.Opt(IDL.Text),
        'hostname' : IDL.Opt(IDL.Text),
        'credentialHeaders' : IDL.Opt(IDL.Vec(HttpHeader)),
        'primary' : IDL.Opt(IDL.Bool),
        'cyclesPerMessageByte' : IDL.Opt(IDL.Nat64),
        'providerId' : IDL.Nat64,
    });

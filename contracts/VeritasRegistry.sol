// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  VeritasRegistry
 * @notice On-chain registry for the Veritas Mesh DePIN network. Stores attestations
 *         of AI inference performed by registered worker nodes. Optimized for low gas
 *         on L2 (Base / Optimism / Arbitrum) — uses events instead of storage for
 *         the heavy "audit trail" payload, with only a compact mapping retained.
 *
 * @dev    A worker submits an Audit Receipt:
 *           receiptHash = sha256(modelId | modelWeightHash | inputHash | outputHash
 *                               | workerNodeId | nonce | timestamp)
 *         along with a zero-knowledge Proof-of-Inference (zkProof) which is verified
 *         off-chain or via an external IVerifier (pluggable).
 *
 *         Verifiers / clients can call {verifyProof} to cheaply confirm a receipt
 *         was registered and not revoked.
 */
interface IZKVerifier {
    function verify(bytes32 receiptHash, bytes calldata zkProof) external view returns (bool);
}

contract VeritasRegistry {
    // ─────────────────────────────────────────────────────────────────────────
    // Errors (cheaper than require strings)
    // ─────────────────────────────────────────────────────────────────────────
    error NotOwner();
    error WorkerNotRegistered();
    error WorkerAlreadyRegistered();
    error WorkerSlashed();
    error EmptyReceipt();
    error InvalidProof();
    error AlreadyRevoked();
    error ReceiptUnknown();

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────
    struct Worker {
        bool registered;
        bool slashed;
        uint64 registeredAt;
        uint128 totalAttestations;
        bytes32 attestationKey; // keccak256 of node's signing pubkey
    }

    struct ReceiptStatus {
        bool exists;
        bool revoked;
        address worker;
        uint64 blockTimestamp;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────
    address public owner;
    IZKVerifier public verifier;

    /// @dev Compact status per receipt. Heavy data stays in events (see below).
    mapping(bytes32 receiptHash => ReceiptStatus) public receipts;

    /// @dev Registered workers.
    mapping(address worker => Worker) public workers;

    /// @dev Total registered attestations (lifetime, monotonically increasing).
    uint256 public totalAttestations;

    // ─────────────────────────────────────────────────────────────────────────
    // Events — these ARE the audit trail. Indexers (TheGraph / Ponder) reconstruct
    // full history off-chain at zero on-chain storage cost.
    // ─────────────────────────────────────────────────────────────────────────
    event WorkerRegistered(address indexed worker, bytes32 attestationKey, uint64 timestamp);
    event WorkerSlashedEvent(address indexed worker, string reason);

    event AuditSubmitted(
        bytes32 indexed receiptHash,
        address indexed worker,
        bytes32 indexed modelId,
        bytes32 inputHash,
        bytes32 outputHash,
        bytes32 modelWeightHash,
        bytes32 nonce,
        uint64 timestamp
    );

    event AuditRevoked(bytes32 indexed receiptHash, address indexed by, string reason);
    event VerifierUpdated(address indexed previous, address indexed next);

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(address _verifier) {
        owner = msg.sender;
        verifier = IZKVerifier(_verifier);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Owner ops
    // ─────────────────────────────────────────────────────────────────────────
    function setVerifier(address _verifier) external onlyOwner {
        emit VerifierUpdated(address(verifier), _verifier);
        verifier = IZKVerifier(_verifier);
    }

    function slashWorker(address worker, string calldata reason) external onlyOwner {
        Worker storage w = workers[worker];
        if (!w.registered) revert WorkerNotRegistered();
        w.slashed = true;
        emit WorkerSlashedEvent(worker, reason);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Worker lifecycle
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * @notice Register a worker node. Pubkey hash is committed for later signature checks.
     * @param attestationKey keccak256 of the node's secp256k1 / BLS signing pubkey.
     */
    function registerWorker(bytes32 attestationKey) external {
        Worker storage w = workers[msg.sender];
        if (w.registered) revert WorkerAlreadyRegistered();
        w.registered = true;
        w.registeredAt = uint64(block.timestamp);
        w.attestationKey = attestationKey;
        emit WorkerRegistered(msg.sender, attestationKey, uint64(block.timestamp));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Audit submission
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * @notice Submit an Audit Receipt with an associated ZK Proof-of-Inference.
     * @dev    Only the receipt status is persisted in storage. All heavy payload
     *         fields are emitted via {AuditSubmitted} for off-chain indexing.
     *
     * @param receiptHash       sha256 commitment over the full receipt payload.
     * @param modelId           keccak256("veritas/<model-name>").
     * @param modelWeightHash   Merkle root over the model weight chunks.
     * @param inputHash         sha256 of the prompt payload.
     * @param outputHash        sha256 of the inference output.
     * @param nonce             Worker-supplied randomness preventing replay.
     * @param zkProof           Encoded ZK proof bytes; verified by {verifier}.
     */
    function submitAudit(
        bytes32 receiptHash,
        bytes32 modelId,
        bytes32 modelWeightHash,
        bytes32 inputHash,
        bytes32 outputHash,
        bytes32 nonce,
        bytes calldata zkProof
    ) external {
        if (receiptHash == bytes32(0)) revert EmptyReceipt();

        Worker storage w = workers[msg.sender];
        if (!w.registered) revert WorkerNotRegistered();
        if (w.slashed) revert WorkerSlashed();

        // External ZK verification — pluggable for Groth16 / PLONK / STARK.
        if (address(verifier) != address(0)) {
            if (!verifier.verify(receiptHash, zkProof)) revert InvalidProof();
        }

        receipts[receiptHash] = ReceiptStatus({
            exists: true,
            revoked: false,
            worker: msg.sender,
            blockTimestamp: uint64(block.timestamp)
        });

        unchecked {
            w.totalAttestations += 1;
            totalAttestations += 1;
        }

        emit AuditSubmitted(
            receiptHash,
            msg.sender,
            modelId,
            inputHash,
            outputHash,
            modelWeightHash,
            nonce,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Owner-only escape hatch to revoke a previously-registered receipt
     *         (e.g. if a worker is later proven to have tampered).
     */
    function revokeReceipt(bytes32 receiptHash, string calldata reason) external onlyOwner {
        ReceiptStatus storage r = receipts[receiptHash];
        if (!r.exists) revert ReceiptUnknown();
        if (r.revoked) revert AlreadyRevoked();
        r.revoked = true;
        emit AuditRevoked(receiptHash, msg.sender, reason);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * @notice Cheap on-chain check: did this receipt get registered, and is it
     *         still valid (non-revoked)?
     */
    function verifyProof(bytes32 receiptHash) external view returns (bool valid, address worker, uint64 ts) {
        ReceiptStatus storage r = receipts[receiptHash];
        if (!r.exists || r.revoked) {
            return (false, address(0), 0);
        }
        return (true, r.worker, r.blockTimestamp);
    }

    function workerInfo(address w) external view returns (Worker memory) {
        return workers[w];
    }
}

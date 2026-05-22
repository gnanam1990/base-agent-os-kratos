// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title KratosRegistry
/// @notice On-chain registry for adversarial audit results written by the Kratos agent.
contract KratosRegistry is Ownable {
    /// @notice Possible severity levels for an audit finding.
    enum Severity {
        Clean,
        Low,
        High,
        Critical
    }

    /// @notice Possible audit tiers.
    enum Tier {
        Fast,
        Standard,
        Deep
    }

    /// @notice A single audit record stored on-chain.
    struct AuditRecord {
        address target;
        bytes32 sourceHash;
        uint64 auditedAt;
        uint8 severity;
        uint16 findingsCount;
        bytes32 attestationUID;
        uint8 tier;
    }

    /// @notice The agent wallet authorised to write records.
    address public agent;

    /// @notice Total number of audits recorded.
    uint256 public totalAudits;

    /// @notice Mapping from keccak256(target, sourceHash) to the audit record.
    mapping(bytes32 => AuditRecord) public audits;

    /// @notice Emitted when a new audit is recorded.
    event AuditRecorded(
        bytes32 indexed auditKey,
        address indexed target,
        bytes32 indexed sourceHash,
        uint8 severity,
        uint16 findingsCount,
        bytes32 attestationUID,
        uint8 tier,
        uint64 timestamp
    );

    /// @notice Thrown when a non-agent address calls an agent-only function.
    error NotAgent();

    /// @notice Thrown when sourceHash is zero.
    error ZeroSourceHash();

    /// @notice Thrown when an audit key already exists.
    error AuditAlreadyExists();

    /// @notice Deploy the registry with an initial agent.
    /// @param _agent The address authorised to record audits.
    constructor(address _agent) Ownable(msg.sender) {
        agent = _agent;
    }

    /// @notice Update the authorised agent address.
    /// @param _newAgent The new agent address.
    function setAgent(address _newAgent) external onlyOwner {
        agent = _newAgent;
    }

    /// @notice Record a completed audit on-chain.
    /// @param target The audited contract address.
    /// @param sourceHash A hash identifying the source code / commit audited.
    /// @param severity The highest severity found (0–3).
    /// @param findingsCount The number of findings.
    /// @param attestationUID The EAS attestation UID (bytes32(0) if none).
    /// @param tier The audit tier used (0–2).
    function recordAudit(
        address target,
        bytes32 sourceHash,
        uint8 severity,
        uint16 findingsCount,
        bytes32 attestationUID,
        uint8 tier
    ) external {
        if (msg.sender != agent) revert NotAgent();
        if (sourceHash == bytes32(0)) revert ZeroSourceHash();

        bytes32 key = keccak256(abi.encodePacked(target, sourceHash));
        if (audits[key].auditedAt != 0) revert AuditAlreadyExists();

        uint64 now_ = uint64(block.timestamp);
        audits[key] = AuditRecord({
            target: target,
            sourceHash: sourceHash,
            auditedAt: now_,
            severity: severity,
            findingsCount: findingsCount,
            attestationUID: attestationUID,
            tier: tier
        });

        unchecked {
            totalAudits++;
        }

        emit AuditRecorded(key, target, sourceHash, severity, findingsCount, attestationUID, tier, now_);
    }

    /// @notice Retrieve an audit record by target and source hash.
    /// @param target The audited contract address.
    /// @param sourceHash The source hash.
    /// @return The audit record.
    function getAudit(address target, bytes32 sourceHash) external view returns (AuditRecord memory) {
        bytes32 key = keccak256(abi.encodePacked(target, sourceHash));
        return audits[key];
    }
}

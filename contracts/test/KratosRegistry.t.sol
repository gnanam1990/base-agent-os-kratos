// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {KratosRegistry} from "../src/KratosRegistry.sol";

contract KratosRegistryTest is Test {
    KratosRegistry public registry;

    address public owner = address(this);
    address public agentAddr = makeAddr("agent");
    address public nonOwner = makeAddr("nonOwner");
    address public targetContract = makeAddr("target");

    bytes32 public sourceHash = keccak256("source-v1");

    function setUp() public {
        registry = new KratosRegistry(agentAddr);
    }

    // ─── Constructor & Access ────────────────────────────────────────

    function test_constructor_setsOwner() public view {
        assertEq(registry.owner(), owner);
    }

    function test_constructor_setsAgent() public view {
        assertEq(registry.agent(), agentAddr);
    }

    function test_setAgent_byOwner_succeeds() public {
        address newAgent = makeAddr("newAgent");
        registry.setAgent(newAgent);
        assertEq(registry.agent(), newAgent);
    }

    function test_setAgent_byNonOwner_reverts() public {
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", nonOwner));
        registry.setAgent(address(1));
    }

    // ─── recordAudit — Happy path ───────────────────────────────────

    function test_recordAudit_happyPath() public {
        vm.prank(agentAddr);
        registry.recordAudit(targetContract, sourceHash, 2, 5, bytes32(0), 1);

        KratosRegistry.AuditRecord memory rec = registry.getAudit(targetContract, sourceHash);
        assertEq(rec.target, targetContract);
        assertEq(rec.sourceHash, sourceHash);
        assertEq(rec.severity, 2);
        assertEq(rec.findingsCount, 5);
        assertEq(rec.tier, 1);
        assertTrue(rec.auditedAt > 0);
    }

    function test_recordAudit_incrementsTotalAudits() public {
        vm.startPrank(agentAddr);
        registry.recordAudit(targetContract, sourceHash, 1, 3, bytes32(0), 0);

        address other = makeAddr("other");
        bytes32 otherHash = keccak256("other-source");
        registry.recordAudit(other, otherHash, 0, 0, bytes32(0), 0);
        vm.stopPrank();

        assertEq(registry.totalAudits(), 2);
    }

    function test_recordAudit_emitsEvent() public {
        bytes32 expectedKey = keccak256(abi.encodePacked(targetContract, sourceHash));
        bytes32 attUID = keccak256("attestation");

        vm.expectEmit(true, true, true, true);
        emit KratosRegistry.AuditRecorded(expectedKey, targetContract, sourceHash, 3, 10, attUID, 2, uint64(block.timestamp));

        vm.prank(agentAddr);
        registry.recordAudit(targetContract, sourceHash, 3, 10, attUID, 2);
    }

    // ─── recordAudit — Permission checks ────────────────────────────

    function test_recordAudit_nonAgent_reverts() public {
        vm.prank(nonOwner);
        vm.expectRevert(KratosRegistry.NotAgent.selector);
        registry.recordAudit(targetContract, sourceHash, 1, 1, bytes32(0), 0);
    }

    // ─── recordAudit — Input validation ─────────────────────────────

    function test_recordAudit_zeroSourceHash_reverts() public {
        vm.prank(agentAddr);
        vm.expectRevert(KratosRegistry.ZeroSourceHash.selector);
        registry.recordAudit(targetContract, bytes32(0), 1, 1, bytes32(0), 0);
    }

    // ─── recordAudit — Duplicate prevention ─────────────────────────

    function test_recordAudit_duplicate_reverts() public {
        vm.startPrank(agentAddr);
        registry.recordAudit(targetContract, sourceHash, 1, 1, bytes32(0), 0);

        vm.expectRevert(KratosRegistry.AuditAlreadyExists.selector);
        registry.recordAudit(targetContract, sourceHash, 2, 5, bytes32(0), 1);
        vm.stopPrank();
    }

    // ─── recordAudit — Tier combinations ────────────────────────────

    function test_recordAudit_fastTier() public {
        vm.prank(agentAddr);
        registry.recordAudit(targetContract, keccak256("fast"), 0, 0, bytes32(0), 0);
        assertEq(registry.getAudit(targetContract, keccak256("fast")).tier, 0);
    }

    function test_recordAudit_standardTier() public {
        vm.prank(agentAddr);
        registry.recordAudit(targetContract, keccak256("std"), 1, 2, bytes32(0), 1);
        assertEq(registry.getAudit(targetContract, keccak256("std")).tier, 1);
    }

    function test_recordAudit_deepTier() public {
        vm.prank(agentAddr);
        registry.recordAudit(targetContract, keccak256("deep"), 3, 20, bytes32(0), 2);
        assertEq(registry.getAudit(targetContract, keccak256("deep")).tier, 2);
    }

    // ─── recordAudit — Severity combinations ────────────────────────

    function test_recordAudit_severityClean() public {
        vm.prank(agentAddr);
        registry.recordAudit(targetContract, keccak256("clean"), 0, 0, bytes32(0), 0);
        assertEq(registry.getAudit(targetContract, keccak256("clean")).severity, 0);
    }

    function test_recordAudit_severityCritical() public {
        vm.prank(agentAddr);
        registry.recordAudit(targetContract, keccak256("crit"), 3, 99, bytes32(0), 2);
        assertEq(registry.getAudit(targetContract, keccak256("crit")).severity, 3);
    }

    // ─── recordAudit — Attestation UID ──────────────────────────────

    function test_recordAudit_withAttestationUID() public {
        bytes32 attUID = keccak256("eas-uid-123");

        vm.prank(agentAddr);
        registry.recordAudit(targetContract, sourceHash, 2, 5, attUID, 1);

        assertEq(registry.getAudit(targetContract, sourceHash).attestationUID, attUID);
    }

    // ─── getAudit — View function ───────────────────────────────────

    function test_getAudit_returnsRecord() public {
        vm.prank(agentAddr);
        registry.recordAudit(targetContract, sourceHash, 2, 5, bytes32(0), 1);

        KratosRegistry.AuditRecord memory rec = registry.getAudit(targetContract, sourceHash);
        assertEq(rec.target, targetContract);
        assertEq(rec.severity, 2);
    }

    function test_getAudit_nonExistent_returnsZero() public {
        KratosRegistry.AuditRecord memory rec = registry.getAudit(targetContract, keccak256("nonexistent"));
        assertEq(rec.target, address(0));
        assertEq(rec.auditedAt, 0);
    }

    function test_getAudit_differentTargets_noCollision() public {
        address other = makeAddr("other");

        vm.startPrank(agentAddr);
        registry.recordAudit(targetContract, sourceHash, 1, 3, bytes32(0), 0);
        registry.recordAudit(other, sourceHash, 3, 10, bytes32(0), 2);
        vm.stopPrank();

        KratosRegistry.AuditRecord memory rec1 = registry.getAudit(targetContract, sourceHash);
        KratosRegistry.AuditRecord memory rec2 = registry.getAudit(other, sourceHash);

        assertEq(rec1.severity, 1);
        assertEq(rec2.severity, 3);
        assertTrue(rec1.target != rec2.target);
    }

    function test_getAudit_differentSources_noCollision() public {
        bytes32 otherHash = keccak256("source-v2");

        vm.startPrank(agentAddr);
        registry.recordAudit(targetContract, sourceHash, 1, 3, bytes32(0), 0);
        registry.recordAudit(targetContract, otherHash, 2, 7, bytes32(0), 1);
        vm.stopPrank();

        KratosRegistry.AuditRecord memory rec1 = registry.getAudit(targetContract, sourceHash);
        KratosRegistry.AuditRecord memory rec2 = registry.getAudit(targetContract, otherHash);

        assertEq(rec1.severity, 1);
        assertEq(rec2.severity, 2);
    }

    // ─── Edge cases ─────────────────────────────────────────────────

    function test_recordAudit_maxFindingsCount() public {
        vm.prank(agentAddr);
        registry.recordAudit(targetContract, keccak256("max"), 3, type(uint16).max, bytes32(0), 2);
        assertEq(registry.getAudit(targetContract, keccak256("max")).findingsCount, type(uint16).max);
    }

    function test_recordAudit_zeroFindingsCount() public {
        vm.prank(agentAddr);
        registry.recordAudit(targetContract, keccak256("zero"), 0, 0, bytes32(0), 0);
        assertEq(registry.getAudit(targetContract, keccak256("zero")).findingsCount, 0);
    }

    function test_recordAudit_timestampAdvances() public {
        vm.startPrank(agentAddr);

        registry.recordAudit(targetContract, keccak256("t1"), 0, 0, bytes32(0), 0);
        uint64 t1 = registry.getAudit(targetContract, keccak256("t1")).auditedAt;

        vm.warp(block.timestamp + 100);

        registry.recordAudit(targetContract, keccak256("t2"), 0, 0, bytes32(0), 0);
        uint64 t2 = registry.getAudit(targetContract, keccak256("t2")).auditedAt;

        vm.stopPrank();

        assertTrue(t2 > t1);
    }

    function test_multipleAudits_totalCount() public {
        vm.startPrank(agentAddr);
        for (uint256 i = 0; i < 10; i++) {
            bytes32 h = keccak256(abi.encode(i));
            registry.recordAudit(makeAddr(string(abi.encodePacked("t", i))), h, 1, 1, bytes32(0), 0);
        }
        vm.stopPrank();

        assertEq(registry.totalAudits(), 10);
    }
}

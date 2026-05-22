// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {KratosRegistry} from "../src/KratosRegistry.sol";

contract Deploy is Script {
    function run() external returns (KratosRegistry reg) {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address agent = vm.envAddress("AGENT_WALLET");
        console.log("Deploying KratosRegistry");
        console.log("  Deployer:", vm.addr(pk));
        console.log("  Agent:", agent);
        vm.startBroadcast(pk);
        reg = new KratosRegistry(agent);
        vm.stopBroadcast();
        console.log("Deployed at:", address(reg));
    }
}

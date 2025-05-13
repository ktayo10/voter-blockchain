// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Election.sol";
import "./VoterRegistry.sol";

/**
 * @title ElectionFactory
 * @dev Factory contract for creating and managing multiple elections
 */
contract ElectionFactory {
    // Election information
    struct ElectionInfo {
        address electionAddress;
        string name;
        string description;
        address owner;
        uint256 creationTime;
        bool isActive;
    }
    
    // Admin management
    address public admin;
    mapping(address => bool) public managers;
    
    // Elections storage
    ElectionInfo[] public elections;
    mapping(address => bool) public registeredElections;
    
    // Voter registry
    VoterRegistry public voterRegistry;
    
    // Events
    event ElectionCreated(address indexed electionAddress, string name, address owner);
    event ElectionDeactivated(address indexed electionAddress);
    event ManagerAdded(address indexed manager);
    event ManagerRemoved(address indexed manager);
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    modifier onlyManager() {
        require(managers[msg.sender] || msg.sender == admin, "Only managers can perform this action");
        _;
    }
    
    /**
     * @dev Initialize the factory with an admin and voter registry
     * @param _voterRegistry Address of the deployed VoterRegistry contract
     */
    constructor(address _voterRegistry) {
        admin = msg.sender;
        managers[msg.sender] = true;
        voterRegistry = VoterRegistry(_voterRegistry);
    }
    
    /**
     * @dev Add a manager who can create elections
     * @param _manager Address of the manager to add
     */
    function addManager(address _manager) public onlyAdmin {
        require(_manager != address(0), "Invalid address");
        managers[_manager] = true;
        emit ManagerAdded(_manager);
    }
    
    /**
     * @dev Remove a manager
     * @param _manager Address of the manager to remove
     */
    function removeManager(address _manager) public onlyAdmin {
        managers[_manager] = false;
        emit ManagerRemoved(_manager);
    }
    
    /**
     * @dev Create a new election
     * @param _name Name of the election
     * @param _description Description of the election
     * @return Address of the newly created election
     */
    function createElection(string memory _name, string memory _description) public onlyManager returns (address) {
        Election newElection = new Election(_name, _description);
        
        ElectionInfo memory info = ElectionInfo({
            electionAddress: address(newElection),
            name: _name,
            description: _description,
            owner: msg.sender,
            creationTime: block.timestamp,
            isActive: true
        });
        
        elections.push(info);
        registeredElections[address(newElection)] = true;
        
        emit ElectionCreated(address(newElection), _name, msg.sender);
        return address(newElection);
    }
    
    /**
     * @dev Deactivate an election
     * @param _electionAddress Address of the election to deactivate
     */
    function deactivateElection(address _electionAddress) public onlyAdmin {
        require(registeredElections[_electionAddress], "Election not registered");
        
        for (uint i = 0; i < elections.length; i++) {
            if (elections[i].electionAddress == _electionAddress) {
                elections[i].isActive = false;
                break;
            }
        }
        
        emit ElectionDeactivated(_electionAddress);
    }
    
    /**
     * @dev Get the count of all elections created
     * @return Number of elections
     */
    function getElectionCount() public view returns (uint256) {
        return elections.length;
    }
    
    /**
     * @dev Check if an address is a registered election
     * @param _electionAddress Address to check
     * @return Whether the address is a registered election
     */
    function isRegisteredElection(address _electionAddress) public view returns (bool) {
        return registeredElections[_electionAddress];
    }
    
    /**
     * @dev Get election information by index
     * @param _index Index of the election
     * @return Election address, name, description, owner, creation time, and active status
     */
    function getElectionInfo(uint256 _index) public view returns (address, string memory, string memory, address, uint256, bool) {
        require(_index < elections.length, "Election index out of bounds");
        
        ElectionInfo memory info = elections[_index];
        return (
            info.electionAddress,
            info.name,
            info.description,
            info.owner,
            info.creationTime,
            info.isActive
        );
    }
    
    /**
     * @dev Get active elections
     * @return Array of active election addresses
     */
    function getActiveElections() public view returns (address[] memory) {
        uint256 activeCount = 0;
        
        // Count active elections
        for (uint i = 0; i < elections.length; i++) {
            if (elections[i].isActive) {
                activeCount++;
            }
        }
        
        // Populate result array
        address[] memory activeElections = new address[](activeCount);
        uint256 currentIndex = 0;
        
        for (uint i = 0; i < elections.length; i++) {
            if (elections[i].isActive) {
                activeElections[currentIndex] = elections[i].electionAddress;
                currentIndex++;
            }
        }
        
        return activeElections;
    }
}
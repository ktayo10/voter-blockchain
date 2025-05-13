// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title VoterRegistry
 * @dev Manages voter registration, identity verification, and eligibility 
 */
contract VoterRegistry {
    // Voter information
    struct VoterInfo {
        bool isRegistered;
        bool isVerified;
        string fullName;
        string idHash; // Hash of identification document
        uint256 registrationTime;
    }
    
    // Admin and verifiers
    address public admin;
    mapping(address => bool) public verifiers;
    
    // Voter data storage
    mapping(address => VoterInfo) public voters;
    uint256 public registeredVoterCount;
    uint256 public verifiedVoterCount;
    
    // Events
    event VoterRegistered(address indexed voter);
    event VoterVerified(address indexed voter);
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);
    event VoterRemoved(address indexed voter);
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    modifier onlyVerifier() {
        require(verifiers[msg.sender] || msg.sender == admin, "Only verifiers can perform this action");
        _;
    }
    
    /**
     * @dev Initialize the registry with the admin
     */
    constructor() {
        admin = msg.sender;
    }
    
    /**
     * @dev Add a verifier who can verify voters
     * @param _verifier Address of the verifier
     */
    function addVerifier(address _verifier) public onlyAdmin {
        require(_verifier != address(0), "Invalid address");
        verifiers[_verifier] = true;
        emit VerifierAdded(_verifier);
    }
    
    /**
     * @dev Remove a verifier
     * @param _verifier Address of the verifier to remove
     */
    function removeVerifier(address _verifier) public onlyAdmin {
        verifiers[_verifier] = false;
        emit VerifierRemoved(_verifier);
    }
    
    /**
     * @dev Register a new voter
     * @param _fullName Full name of the voter
     * @param _idHash Hash of the voter's identification document
     */
    function registerVoter(string memory _fullName, string memory _idHash) public {
        require(!voters[msg.sender].isRegistered, "Voter already registered");
        require(bytes(_fullName).length > 0, "Name cannot be empty");
        require(bytes(_idHash).length > 0, "ID hash cannot be empty");
        
        voters[msg.sender] = VoterInfo({
            isRegistered: true,
            isVerified: false,
            fullName: _fullName,
            idHash: _idHash,
            registrationTime: block.timestamp
        });
        
        registeredVoterCount++;
        emit VoterRegistered(msg.sender);
    }
    
    /**
     * @dev Verify a voter's identity (only authorized verifiers)
     * @param _voter Address of the voter to verify
     */
    function verifyVoter(address _voter) public onlyVerifier {
        require(voters[_voter].isRegistered, "Voter not registered");
        require(!voters[_voter].isVerified, "Voter already verified");
        
        voters[_voter].isVerified = true;
        verifiedVoterCount++;
        
        emit VoterVerified(_voter);
    }
    
    /**
     * @dev Remove a voter from the registry (admin only)
     * @param _voter Address of the voter to remove
     */
    function removeVoter(address _voter) public onlyAdmin {
        require(voters[_voter].isRegistered, "Voter not registered");
        
        if (voters[_voter].isVerified) {
            verifiedVoterCount--;
        }
        
        delete voters[_voter];
        registeredVoterCount--;
        
        emit VoterRemoved(_voter);
    }
    
    /**
     * @dev Check if a voter is registered
     * @param _voter Address of the voter to check
     * @return Whether the voter is registered
     */
    function isRegistered(address _voter) public view returns (bool) {
        return voters[_voter].isRegistered;
    }
    
    /**
     * @dev Check if a voter is verified and eligible
     * @param _voter Address of the voter to check
     * @return Whether the voter is verified and eligible to vote
     */
    function isEligible(address _voter) public view returns (bool) {
        return voters[_voter].isRegistered && voters[_voter].isVerified;
    }
    
    /**
     * @dev Get voter information
     * @param _voter Address of the voter
     * @return Whether the voter is registered, verified, and their registration time
     */
    function getVoterInfo(address _voter) public view returns (bool, bool, uint256) {
        return (voters[_voter].isRegistered, voters[_voter].isVerified, voters[_voter].registrationTime);
    }
}
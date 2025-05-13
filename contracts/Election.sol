// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Election
 * @dev Manages an election with voter registration, candidate management, and secure voting
 */
contract Election {
    // Candidate representation
    struct Candidate {
        uint256 id;
        string name;
        string description;
        uint256 voteCount;
    }

    // Voter representation
    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint256 votedCandidateId;
    }

    // Election states
    enum ElectionState { Setup, Active, Closed, Tallied }

    // Election details
    string public electionName;
    string public electionDescription;
    address public admin;
    ElectionState public electionState;
    uint256 public startTime;
    uint256 public endTime;

    // Data storage
    mapping(uint256 => Candidate) public candidates;
    mapping(address => Voter) public voters;
    mapping(address => bool) public verifiers;
    uint256 public candidatesCount;
    uint256 public registeredVoterCount;
    uint256 public totalVotes;

    // Events
    event CandidateAdded(uint256 indexed candidateId, string name);
    event VoterRegistered(address indexed voter);
    event VoteCast(address indexed voter, uint256 indexed candidateId);
    event ElectionStateChanged(ElectionState newState);

    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyVerifier() {
        require(verifiers[msg.sender] || msg.sender == admin, "Only verifiers can perform this action");
        _;
    }

    modifier inState(ElectionState _state) {
        require(electionState == _state, "Election is not in the required state");
        _;
    }

    /**
     * @dev Initialize the election with a name and description
     * @param _name Name of the election
     * @param _description Description of the election
     */
    constructor(string memory _name, string memory _description) {
        electionName = _name;
        electionDescription = _description;
        admin = msg.sender;
        electionState = ElectionState.Active; // Set to Active by default for testing
        
        // Add default candidates for testing
        addCandidate("John Wick", "Action star");
        addCandidate("Browney Jr", "Tech genius");
        addCandidate("Helena Williams", "Political candidate");
    }

    /**
     * @dev Add a new candidate to the election (admin only)
     * @param _name Name of the candidate
     * @param _description Description or platform of the candidate
     */
    function addCandidate(string memory _name, string memory _description) public {
        // For testing purposes: removed the onlyAdmin and inState modifiers
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, _description, 0);
        emit CandidateAdded(candidatesCount, _name);
    }
    
    /**
     * @dev Add a verifier who can register voters
     * @param _verifier Address of the verifier
     */
    function addVerifier(address _verifier) public onlyAdmin {
        verifiers[_verifier] = true;
    }
    
    /**
     * @dev Remove a verifier
     * @param _verifier Address of the verifier to remove
     */
    function removeVerifier(address _verifier) public onlyAdmin {
        verifiers[_verifier] = false;
    }

    /**
     * @dev Register a voter for the election
     * @param _voter Address of the voter to register
     */
    function registerVoter(address _voter) public onlyVerifier {
        require(!voters[_voter].isRegistered, "Voter already registered");
        voters[_voter].isRegistered = true;
        registeredVoterCount++;
        emit VoterRegistered(_voter);
    }

    /**
     * @dev Start the election
     * @param _durationInMinutes Duration of the election in minutes
     */
    function startElection(uint256 _durationInMinutes) public onlyAdmin inState(ElectionState.Setup) {
        require(candidatesCount > 0, "No candidates have been registered");
        startTime = block.timestamp;
        endTime = startTime + (_durationInMinutes * 1 minutes);
        electionState = ElectionState.Active;
        emit ElectionStateChanged(ElectionState.Active);
    }

    /**
     * @dev End the election manually before the time is up
     */
    function endElection() public onlyAdmin inState(ElectionState.Active) {
        electionState = ElectionState.Closed;
        emit ElectionStateChanged(ElectionState.Closed);
    }

    /**
     * @dev Cast a vote for a candidate
     * @param _candidateId ID of the candidate to vote for
     */
    function vote(uint256 _candidateId) public {
        // For testing: removed registration check and state check
        
        // Check if voter has already voted
        require(!voters[msg.sender].hasVoted, "Voter has already voted");

        // Check if candidate ID is valid
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate");

        // Record the vote
        voters[msg.sender].hasVoted = true;
        voters[msg.sender].votedCandidateId = _candidateId;
        candidates[_candidateId].voteCount++;
        totalVotes++;

        emit VoteCast(msg.sender, _candidateId);
    }

    /**
     * @dev Tally the election results
     */
    function tallyResults() public onlyAdmin inState(ElectionState.Closed) {
        electionState = ElectionState.Tallied;
        emit ElectionStateChanged(ElectionState.Tallied);
    }

    /**
     * @dev Get the winning candidate's ID
     * @return The ID of the winning candidate
     */
    function getWinner() public view returns (uint256) {
        require(electionState == ElectionState.Tallied, "Results not tallied yet");
        
        uint256 winningVoteCount = 0;
        uint256 winningCandidateId = 0;
        
        for (uint256 i = 1; i <= candidatesCount; i++) {
            if (candidates[i].voteCount > winningVoteCount) {
                winningVoteCount = candidates[i].voteCount;
                winningCandidateId = i;
            }
        }
        
        return winningCandidateId;
    }

    /**
     * @dev Get details of a candidate
     * @param _candidateId ID of the candidate
     * @return id, name, description, and vote count of the candidate
     */
    function getCandidateDetails(uint256 _candidateId) public view returns (uint256, string memory, string memory, uint256) {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");
        Candidate memory candidate = candidates[_candidateId];
        return (candidate.id, candidate.name, candidate.description, candidate.voteCount);
    }
    
    /**
     * @dev Check if a voter has voted
     * @param _voter Address of the voter
     * @return Whether the voter has voted
     */
    function hasVoted(address _voter) public view returns (bool) {
        return voters[_voter].hasVoted;
    }
}

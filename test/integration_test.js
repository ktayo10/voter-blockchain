const Election = artifacts.require("./Election.sol");

contract("Election Integration Tests", function (accounts) {
    let electionInstance;
    const adminAccount = accounts[0];
    const voter1 = accounts[1];
    const voter2 = accounts[2];
    const voter3 = accounts[3];
    
    // Track the initial state before any tests
    before(async function() {
        electionInstance = await Election.deployed();
    });
    
    describe("Complete Voting Process Integration", function() {
        it("completes a full voting process with multiple voters", async function() {
            // Step 1: Verify initial state
            const initialCount = await electionInstance.candidatesCount();
            assert.equal(initialCount, 3, "Should start with 3 candidates");
            
            // Step 2: First voter selects and votes for a candidate
            await electionInstance.vote(1, { from: voter1 });
            
            // Verify the vote was recorded
            const candidate1AfterVote1 = await electionInstance.candidates(1);
            assert.equal(candidate1AfterVote1[2], 1, "Candidate 1 should have 1 vote");
            
            // Verify the voter is marked as having voted
            const voter1Status = await electionInstance.voters(voter1);
            assert.equal(voter1Status, true, "Voter 1 should be marked as having voted");
            
            // Step 3: Second voter votes for a different candidate
            await electionInstance.vote(2, { from: voter2 });
            
            // Verify second vote
            const candidate2AfterVote = await electionInstance.candidates(2);
            assert.equal(candidate2AfterVote[2], 1, "Candidate 2 should have 1 vote");
            
            // Step 4: Third voter votes for the first candidate again
            await electionInstance.vote(1, { from: voter3 });
            
            // Verify the totals after all votes
            const finalCandidate1 = await electionInstance.candidates(1);
            const finalCandidate2 = await electionInstance.candidates(2);
            const finalCandidate3 = await electionInstance.candidates(3);
            
            assert.equal(finalCandidate1[2], 2, "Candidate 1 should have 2 votes");
            assert.equal(finalCandidate2[2], 1, "Candidate 2 should have 1 vote");
            assert.equal(finalCandidate3[2], 0, "Candidate 3 should have 0 votes");
        });
        
        it("prevents double voting throughout the entire process", async function() {
            // Try to vote again with the first voter
            try {
                await electionInstance.vote(3, { from: voter1 });
                assert.fail("Should not allow double voting");
            } catch (error) {
                assert(error.message.indexOf("Already voted") >= 0, "Should prevent double voting with correct error");
            }
            
            // Verify vote counts haven't changed after attempted double vote
            const candidate3AfterAttempt = await electionInstance.candidates(3);
            assert.equal(candidate3AfterAttempt[2], 0, "Candidate 3 should still have 0 votes after failed attempt");
        });
    });
    
    describe("System-wide Requirements", function() {
        it("ensures the integrity of the election results", async function() {
            // Calculate total votes across all candidates
            let totalVotes = 0;
            const candidateCount = await electionInstance.candidatesCount();
            
            for (let i = 1; i <= candidateCount; i++) {
                const candidate = await electionInstance.candidates(i);
                totalVotes += parseInt(candidate[2]);
            }
            
            // Count how many addresses have voted
            let voterCount = 0;
            for (let i = 0; i < 4; i++) { // Check first 4 accounts
                const hasVoted = await electionInstance.voters(accounts[i]);
                if (hasVoted) voterCount++;
            }
            
            // Verify that total votes equals number of voters who have voted
            assert.equal(totalVotes, voterCount, "Total votes should equal number of voters who have participated");
        });
    });
});
const Election = artifacts.require("./Election.sol");

contract("Election Security Tests", function (accounts) {
    let electionInstance;
    
    before(async function() {
        electionInstance = await Election.deployed();
    });
    
    describe("Access Control", function() {
        it("prevents unauthorized access to vote", async function() {
            // Vote with one account
            await electionInstance.vote(1, { from: accounts[4] });
            
            // Verify the account is marked as having voted
            const hasVoted = await electionInstance.voters(accounts[4]);
            assert.equal(hasVoted, true, "Voter should be marked as having voted");
            
            // Attempt to vote again
            try {
                await electionInstance.vote(2, { from: accounts[4] });
                assert.fail("Should have thrown an error");
            } catch (error) {
                assert(error.message.indexOf("Already voted") >= 0, "Error message should indicate voter has already voted");
            }
        });
        
        it("ensures each voter can only vote once across multiple candidates", async function() {
            // Vote for candidate 1
            await electionInstance.vote(1, { from: accounts[5] });
            
            // Try to vote for candidate 2 with the same account
            try {
                await electionInstance.vote(2, { from: accounts[5] });
                assert.fail("Should have thrown an error");
            } catch (error) {
                assert(error.message.indexOf("Already voted") >= 0, "Error message should indicate voter has already voted");
            }
            
            // Try to vote for candidate 3 with the same account
            try {
                await electionInstance.vote(3, { from: accounts[5] });
                assert.fail("Should have thrown an error");
            } catch (error) {
                assert(error.message.indexOf("Already voted") >= 0, "Error message should indicate voter has already voted");
            }
        });
    });
    
    describe("Input Validation", function() {
        it("rejects votes for non-existent candidates", async function() {
            // Try to vote for candidate ID 0 (should not exist)
            try {
                await electionInstance.vote(0, { from: accounts[6] });
                assert.fail("Should have thrown an error");
            } catch (error) {
                assert(error.message.indexOf("Invalid candidate") >= 0, "Error message should indicate invalid candidate");
            }
            
            // Try to vote for candidate ID that is too high
            const candidateCount = await electionInstance.candidatesCount();
            
            try {
                await electionInstance.vote(candidateCount.toNumber() + 1, { from: accounts[6] });
                assert.fail("Should have thrown an error");
            } catch (error) {
                assert(error.message.indexOf("Invalid candidate") >= 0, "Error message should indicate invalid candidate");
            }
        });
    });
    
    describe("Data Integrity", function() {
        it("ensures vote counts are accurate after multiple transactions", async function() {
            // Get starting vote count for candidate 2
            const startCandidate = await electionInstance.candidates(2);
            const startVotes = startCandidate[2].toNumber();
            
            // Multiple votes from different accounts
            await electionInstance.vote(2, { from: accounts[6] });
            await electionInstance.vote(2, { from: accounts[7] });
            
            // Check that vote count increased by exactly 2
            const endCandidate = await electionInstance.candidates(2);
            const endVotes = endCandidate[2].toNumber();
            
            assert.equal(endVotes, startVotes + 2, "Vote count should increase by exactly the number of new votes");
        });
        
        it("verifies candidates cannot be tampered with", async function() {
            // Get the existing candidate information
            const originalCandidate = await electionInstance.candidates(3);
            const originalName = originalCandidate[1];
            const originalVotes = originalCandidate[2].toNumber();
            
            // Add a vote
            await electionInstance.vote(3, { from: accounts[8] });
            
            // Verify the vote count increased but name didn't change
            const updatedCandidate = await electionInstance.candidates(3);
            const updatedName = updatedCandidate[1];
            const updatedVotes = updatedCandidate[2].toNumber();
            
            assert.equal(updatedName, originalName, "Candidate name should remain unchanged");
            assert.equal(updatedVotes, originalVotes + 1, "Vote count should increase by 1");
        });
    });
});
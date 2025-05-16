var Election = artifacts.require("./Election.sol");

contract("Election", function (accounts) {
    var electionInstance;

    it("initializes with three candidates", function () {
        return Election.deployed().then(function (instance) {
            return instance.candidatesCount();
        }).then(function (count) {
            assert.equal(count, 3);
        });
    });

    it("it initializes the candidates with the correct values", function () {
        return Election.deployed().then(function (instance) {
            electionInstance = instance;
            return electionInstance.candidates(1);
        }).then(function (candidate) {
            assert.equal(candidate[0], 1, "contains the correct id");
            assert.equal(candidate[1], "Kylian Mbappe", "contains the correct name");
            assert.equal(candidate[2], 0, "contains the correct votes count");
            return electionInstance.candidates(2);
        }).then(function (candidate) {
            assert.equal(candidate[0], 2, "contains the correct id");
            assert.equal(candidate[1], "Thierry Henry", "contains the correct name");
            assert.equal(candidate[2], 0, "contains the correct votes count");
            return electionInstance.candidates(3);
        }).then(function (candidate) {
            assert.equal(candidate[0], 3, "contains the correct id");
            assert.equal(candidate[1], "Cristiano Ronaldo", "contains the correct name");
            assert.equal(candidate[2], 0, "contains the correct votes count");
        });
    });

    it("allows a voter to cast a vote", function () {
        return Election.deployed().then(function (instance) {
            electionInstance = instance;
            candidateId = 1;
            return electionInstance.vote(candidateId, { from: accounts[0] });
        }).then(function (receipt) {
            assert.equal(receipt.logs.length, 1, "an event was triggered");
            assert.equal(receipt.logs[0].event, "votedEvent", "the event type is correct");
            assert.equal(receipt.logs[0].args._candidateId.toNumber(), candidateId, "the candidate id is correct");
            return electionInstance.voters(accounts[0]);
        }).then(function (voted) {
            assert(voted, "the voter was marked as voted");
            return electionInstance.candidates(candidateId);
        }).then(function (candidate) {
            var voteCount = candidate[2];
            assert.equal(voteCount, 1, "increments the candidate's vote count");
        });
    });

    it("throws an exception for invalid candiates", function () {
        return Election.deployed().then(function (instance) {
            electionInstance = instance;
            return electionInstance.vote(99, { from: accounts[1] })
        }).then(assert.fail).catch(function (error) {
            assert(error.message.indexOf('Invalid candidate') >= 0, "error message must contain 'Invalid candidate'");
            return electionInstance.candidates(1);
        }).then(function (candidate1) {
            var voteCount = candidate1[2];
            assert.equal(voteCount, 1, "candidate 1 did not receive any votes");
            return electionInstance.candidates(2);
        }).then(function (candidate2) {
            var voteCount = candidate2[2];
            assert.equal(voteCount, 0, "candidate 2 did not receive any votes");
        });
    });

    it("throws an exception for double voting", async function () {
        // Use async/await for clearer and more reliable test
        const instance = await Election.deployed();
        const candidateId = 2;
        
        // First vote - make sure to await this transaction
        await instance.vote(candidateId, { from: accounts[1] });
        
        // Verify first vote was accepted
        const candidate = await instance.candidates(candidateId);
        assert.equal(candidate[2].toNumber(), 1, "accepts first vote");
        
        // Try to vote again - this should throw an error
        try {
            await instance.vote(candidateId, { from: accounts[1] });
            assert.fail("Expected an error but did not receive one");
        } catch (error) {
            assert(error.message.indexOf('Already voted') >= 0, "error message must contain 'Already voted'");
        }
        
        // Verify vote counts weren't changed by the second attempt
        const candidate1 = await instance.candidates(1);
        assert.equal(candidate1[2].toNumber(), 1, "candidate 1 did not receive any additional votes");
        
        const candidate2 = await instance.candidates(2);
        assert.equal(candidate2[2].toNumber(), 1, "candidate 2 did not receive any additional votes");
    });

    // Gas Optimization Testing
    it("measures gas usage for vote function", async function() {
        const instance = await Election.deployed();
        // Account 3 votes for candidate 3
        const tx = await instance.vote(3, { from: accounts[2] });
        
        // Check gas used is within acceptable limits
        assert.isBelow(tx.receipt.gasUsed, 100000, "Vote function consumes too much gas");
        console.log(`Gas used for voting: ${tx.receipt.gasUsed}`);
    });

    // Security Testing
    it("prevents unauthorized access to voting", async function() {
        const instance = await Election.deployed();
        
        // Ensure only accounts that haven't voted can vote
        // Account 2 already voted
        try {
            await instance.vote(1, { from: accounts[2] });
            assert.fail("Should have thrown an error");
        } catch (error) {
            assert(error.message.indexOf('Already voted') >= 0, "Should prevent duplicate voting");
        }
    });

    it("ensures every address can only vote once", async function() {
        const instance = await Election.deployed();
        
        // Account 3 votes for the first time
        await instance.vote(1, { from: accounts[3] });
        
        const hasVoted = await instance.voters(accounts[3]);
        assert.equal(hasVoted, true, "Voter should be marked as having voted");
        
        // Try to vote again
        try {
            await instance.vote(2, { from: accounts[3] });
            assert.fail("Should have thrown an error");
        } catch (error) {
            assert(error.message.indexOf('Already voted') >= 0, "Should prevent duplicate voting");
        }
    });

    // Additional unit tests for edge cases
    describe("Edge Cases and Advanced Scenarios", function() {
        it("handles a situation with no votes correctly", async function() {
            // Get a fresh instance for this test
            const newInstance = await Election.new();
            
            // Verify all candidates start with 0 votes
            const candidateCount = await newInstance.candidatesCount();
            
            for (let i = 1; i <= candidateCount; i++) {
                const candidate = await newInstance.candidates(i);
                assert.equal(candidate[2].toNumber(), 0, `Candidate ${i} should start with 0 votes`);
            }
        });
        
        it("verifies vote counting across all candidates", async function() {
            // Get the deployed instance
            const instance = await Election.deployed();
            
            // Get current vote totals
            const candidate1 = await instance.candidates(1);
            const candidate2 = await instance.candidates(2);
            const candidate3 = await instance.candidates(3);
            
            const totalVotes = candidate1[2].toNumber() + 
                              candidate2[2].toNumber() + 
                              candidate3[2].toNumber();
            
            // Count how many accounts have voted
            let voterCount = 0;
            for (let i = 0; i < 10; i++) {
                const hasVoted = await instance.voters(accounts[i]);
                if (hasVoted) voterCount++;
            }
            
            // Total votes should equal number of voters
            assert.equal(totalVotes, voterCount, "Total votes should match number of voters");
        });
    });
    
    describe("Event Emission", function() {
        it("verifies events are emitted correctly with proper parameters", async function() {
            // Use a new account that hasn't voted yet
            const newVoterAccount = accounts[9];
            const candidateId = 2;
            
            // Check if account has already voted, if so we'll skip this test
            const hasVoted = await Election.deployed().then(instance => 
                instance.voters(newVoterAccount)
            );
            
            if (!hasVoted) {
                const receipt = await Election.deployed().then(instance => 
                    instance.vote(candidateId, { from: newVoterAccount })
                );
                
                // Check event was emitted
                assert.equal(receipt.logs.length, 1, "One event should be emitted");
                assert.equal(receipt.logs[0].event, "votedEvent", "Should emit a votedEvent");
                
                // Check event parameters
                assert.equal(
                    receipt.logs[0].args._candidateId.toNumber(), 
                    candidateId, 
                    "Event should contain the correct candidate ID"
                );
            } else {
                console.log("Account has already voted, skipping event test");
            }
        });
    });
});

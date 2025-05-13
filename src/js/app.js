App = {
    web3Provider: null,
    contracts: {},
    account: '0x0',
    hasVoted: false,
    loading: false,
    electionInstance: null,
    voterRegistryInstance: null,
    electionFactoryInstance: null,

    init: async function () {
        // Initialize the app when the page loads
        console.log("Initializing app...");
        return App.initWeb3();
    },

    initWeb3: async function () {
        // Modern browsers with MetaMask
        if (window.ethereum) {
            App.web3Provider = window.ethereum;
            try {
                // Request account access
                await window.ethereum.request({ method: "eth_requestAccounts" });
                
                // Register event listeners for account and chain changes
                window.ethereum.on('accountsChanged', function (accounts) {
                    App.account = accounts[0];
                    App.render();
                });
                
                window.ethereum.on('chainChanged', function () {
                    window.location.reload();
                });
            } catch (error) {
                console.error("User denied account access");
                $("#connectWalletError").html("Please allow access to your MetaMask wallet.");
            }
        }
        // Legacy dApp browsers
        else if (window.web3) {
            App.web3Provider = window.web3.currentProvider;
        }
        // If no web3 provider, use a local provider (e.g., Ganache)
        else {
            App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
        }
        web3 = new Web3(App.web3Provider);

        return App.initContract();
    },

    initContract: function () {
        // Load Election contract
        $.getJSON("Election.json", function (election) {
            // Instantiate a new truffle contract from the artifact
            App.contracts.Election = TruffleContract(election);
            // Connect provider to interact with contract
            App.contracts.Election.setProvider(App.web3Provider);
            
            // Try to load other contracts
            try {
                // Load VoterRegistry contract if available
                $.getJSON("VoterRegistry.json", function(voterRegistry) {
                    App.contracts.VoterRegistry = TruffleContract(voterRegistry);
                    App.contracts.VoterRegistry.setProvider(App.web3Provider);
                }).fail(function() {
                    console.log("VoterRegistry contract not found, continuing without it");
                });
                
                // Load ElectionFactory contract if available
                $.getJSON("ElectionFactory.json", function(electionFactory) {
                    App.contracts.ElectionFactory = TruffleContract(electionFactory);
                    App.contracts.ElectionFactory.setProvider(App.web3Provider);
                }).fail(function() {
                    console.log("ElectionFactory contract not found, continuing without it");
                });
            } catch (error) {
                console.log("Error loading additional contracts:", error);
            }
            
            // Set up event listeners
            App.listenForEvents();
            
            // Render UI
            return App.render();
        }).fail(function(error) {
            console.error("Could not load Election.json:", error);
            $("#systemStatus").text("ERROR: Failed to load contract data");
        });
    },

    // Listen for events from the smart contracts
    listenForEvents: function () {
        App.contracts.Election.deployed().then(function (instance) {
            console.log("Setting up event listeners...");
            
            try {
                // Try to listen for voting events if they exist
                if (instance.VoteCast) {
                    instance.VoteCast({}, {
                        fromBlock: 0,
                        toBlock: 'latest'
                    }).watch(function (error, event) {
                        if (!error) {
                            console.log("Vote cast event:", event);
                            App.render();
                        } else {
                            console.error("Error with voting event:", error);
                        }
                    });
                }
            } catch (error) {
                console.log("VoteCast event not available:", error);
            }
            
            // Use the older votedEvent if available for backwards compatibility
            try {
                if (instance.votedEvent) {
                    instance.votedEvent({}, {
                        fromBlock: 0,
                        toBlock: 'latest'
                    }).watch(function(error, event) {
                        console.log("Voted event triggered", event);
                        App.render();
                    });
                }
            } catch (error) {
                console.log("votedEvent not available:", error);
            }
        }).catch(function(error) {
            console.error("Error setting up event listeners:", error);
        });
    },

    connectWallet: async function () {
        $("#connectWalletBtn").prop('disabled', true);
        $("#connectWalletBtn").html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Connecting...');
        
        try {
            // Request account access if needed
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            App.account = accounts[0];
            console.log("Connected account:", App.account);
            
            // Hide connect button, show account info
            $("#walletSection").hide();
            $("#accountSection").show();
            
            App.render();
        } catch (error) {
            console.error("Could not connect to wallet", error);
            $("#connectWalletError").html("Failed to connect to your wallet. Please try again.");
        } finally {
            $("#connectWalletBtn").prop('disabled', false);
            $("#connectWalletBtn").html('Connect Wallet');
        }
    },
    
    disconnectWallet: function() {
        // We can't actually disconnect from MetaMask via code,
        // but we can reset our UI state
        App.account = '0x0';
        $("#walletSection").show();
        $("#accountSection").hide();
        $("#content").hide();
        $("#loader").show();
        $("#connectWalletError").html("");
    },

    render: function() {
        if (App.loading) {
            return;
        }
        App.loading = true;

        // Show loader
        var loader = $("#loader");
        var content = $("#content");
        loader.show();
        content.hide();

        // Load account data
        web3.eth.getCoinbase(function(err, account) {
            if (err === null) {
                App.account = account;
                if (account) {
                    $("#accountSection").show();
                    $("#walletSection").hide();
                    $("#accountAddress").html("<span id='accountTag'>Your Account:</span> <span id='myAccount'>" + account + "</span>");
                    
                    // Get account balance if web3 utils is available
                    if (web3.utils && web3.utils.fromWei) {
                        web3.eth.getBalance(account).then(function(balance) {
                            const ethBalance = web3.utils.fromWei(balance, 'ether');
                            $("#accountBalance").html("<span>Balance:</span> <span>" + parseFloat(ethBalance).toFixed(4) + " ETH</span>");
                        });
                    }
                } else {
                    $("#accountSection").hide();
                    $("#walletSection").show();
                }
            }
        });

        // Load contract data
        App.contracts.Election.deployed().then(function(instance) {
            App.electionInstance = instance;
            console.log("Contract instance loaded:", instance);

            try {
                // Load election details if available
                if (instance.electionName) {
                    instance.electionName().then(function(name) {
                        $("#electionName").text(name);
                    }).catch(function() {
                        $("#electionName").text("Election");
                    });
                    
                    instance.electionDescription().then(function(description) {
                        $("#electionDescription").text(description);
                    }).catch(function() {
                        $("#electionDescription").text("Blockchain-based voting system");
                    });
                }
            } catch (error) {
                console.log("Could not load election details:", error);
                $("#electionName").text("Election");
                $("#electionDescription").text("Blockchain-based voting system");
            }

            // Load candidates count
            return instance.candidatesCount();
        }).then(function(candidatesCount) {
            console.log("Candidates count:", candidatesCount.toNumber());
            
            // Update statistics
            $("#candidateCount").text(candidatesCount.toNumber());
            
            var candidatesResults = $("#candidatesResults");
            candidatesResults.empty();  

            var candidatesSelect = $('#candidatesSelect');
            candidatesSelect.empty();

            // Fetch all candidates
            var candidatePromises = [];
            var totalVotes = 0;
            
            for (var i = 1; i <= candidatesCount; i++) {
                candidatePromises.push(App.electionInstance.candidates(i).then(function(candidate) {
                    var id = candidate[0].toNumber();
                    var name = candidate[1];
                    var voteCount = candidate[2].toNumber();
                    totalVotes += voteCount;
                    
                    // Store candidate data for later use
                    return {id: id, name: name, voteCount: voteCount};
                }));
            }
            
            // Process all candidates
            Promise.all(candidatePromises).then(function(candidates) {
                // Sort candidates by ID
                candidates.sort(function(a, b) {
                    return a.id - b.id;
                });
                
                // Update total votes
                $("#totalVotes").text(totalVotes);
                
                // Render all candidates
                candidates.forEach(function(candidate) {
                    // Calculate percentage
                    var percentage = totalVotes > 0 ? ((candidate.voteCount / totalVotes) * 100).toFixed(2) + "%" : "0%";
                    
                    // Render candidate Result
                    var candidateTemplate = `
                        <tr>
                            <td>${candidate.id}</td>
                            <td>${candidate.name}</td>
                            <td>${candidate.voteCount}</td>
                            <td>${percentage}</td>
                        </tr>`;
                    candidatesResults.append(candidateTemplate);

                    // Render candidate ballot option
                    var candidateOption = `<option value='${candidate.id}'>${candidate.name}</option>`;
                    candidatesSelect.append(candidateOption);
                });
                
                // Render the chart visualization
                App.renderResultsChart(candidates, totalVotes);
                
                // Check if user has voted
                return App.electionInstance.voters(App.account);
            }).catch(function(error) {
                console.error("Error rendering candidates:", error);
            });
        }).then(function(hasVoted) {
            // Do not allow a user to vote again
            if (hasVoted) {
                $('form').hide();
                $("#voteStatus").show();
                $("#voteStatus").html("<strong>You have already cast your vote!</strong>");
            } else {
                $('form').show();
                $("#voteStatus").hide();
            }
            
            // Try to check election state if the function is available
            try {
                if (App.electionInstance.electionState) {
                    App.electionInstance.electionState().then(function(state) {
                        App.updateElectionStateUI(parseInt(state));
                    }).catch(function() {
                        // Election state not available, default to showing voting UI
                        $("#votingSection").show();
                        $("#electionSetupMessage").hide();
                    });
                } else {
                    // Election state function not available, show voting UI
                    $("#votingSection").show();
                    $("#electionSetupMessage").hide();
                }
            } catch (error) {
                console.log("Election state not available:", error);
                // Default to showing voting UI
                $("#votingSection").show();
                $("#electionSetupMessage").hide();
            }
            
            loader.hide();
            content.show();
        }).catch(function(error) {
            console.error("Error rendering the application:", error);
            $("#error").html("Error: " + error.message).show();
            loader.hide();
        });

        // Try to load voter registry if available
        try {
            if (App.contracts.VoterRegistry) {
                App.contracts.VoterRegistry.deployed().then(function(instance) {
                    App.voterRegistryInstance = instance;
                    return instance.registeredVoterCount();
                }).then(function(count) {
                    $("#registeredVoterCount").text(count.toNumber());
                }).catch(function(error) {
                    console.log("Could not load voter registry:", error);
                });
            }
        } catch (error) {
            console.log("Voter registry not available:", error);
        }

        App.loading = false;
    },
    
    updateElectionStateUI: function(state) {
        // Update UI based on election state
        // 0: Setup, 1: Active, 2: Closed, 3: Tallied
        const stateNames = ["Setup", "Active", "Closed", "Tallied"];
        $("#electionState").text(stateNames[state] || "Unknown");
        
        // Adjust UI components based on state
        if (state === 0) { // Setup
            $("#votingSection").hide();
            $("#electionSetupMessage").show();
            $("#electionSetupMessage").html("<strong>The election is being set up. Voting will open soon.</strong>");
        } else if (state === 1) { // Active
            $("#votingSection").show();
            $("#electionSetupMessage").hide();
        } else { // Closed or Tallied
            $("#votingSection").hide();
            $("#electionSetupMessage").show();
            $("#electionSetupMessage").html("<strong>This election has ended. No more votes can be cast.</strong>");
        }
    },

    castVote: function() {
        // Disable the vote button to prevent multiple clicks
        $("#voteButton").prop('disabled', true);
        $("#voteButton").html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...');
        
        var candidateId = $('#candidatesSelect').val();
        
        // Validate selection
        if (!candidateId) {
            $("#voteError").html("<div class='alert alert-danger'>Please select a candidate</div>");
            $("#voteButton").prop('disabled', false);
            $("#voteButton").html('Vote');
            return;
        }
        
        console.log("Casting vote for candidate ID:", candidateId);
        console.log("Using account:", App.account);
        
        App.contracts.Election.deployed().then(function(instance) {
            // Send the transaction
            return instance.vote(candidateId, { from: App.account });
        }).then(function(result) {
            // Vote successful
            console.log("Vote transaction successful:", result);
            $("#voteSuccess").html("<div class='alert alert-success'>Your vote has been cast successfully!</div>");
            $("#voteForm").hide();
            $("#voteStatus").show();
            $("#voteStatus").html("<strong>You have cast your vote!</strong>");
            
            // Re-render the UI
            App.render();
        }).catch(function(error) {
            // Vote failed
            console.error("Error casting vote:", error);
            let errorMessage = "Failed to cast your vote. Please try again.";
            
            // Extract more specific error messages if possible
            if (error.message) {
                if (error.message.includes("revert")) {
                    if (error.message.includes("already voted")) {
                        errorMessage = "You have already cast your vote in this election.";
                    } else if (error.message.includes("not registered")) {
                        errorMessage = "You are not registered to vote in this election.";
                    } else if (error.message.includes("ended")) {
                        errorMessage = "This election has already ended.";
                    }
                }
            }
            
            $("#voteError").html("<div class='alert alert-danger'>" + errorMessage + "</div>");
        }).finally(function() {
            // Re-enable the vote button
            $("#voteButton").prop('disabled', false);
            $("#voteButton").html('Vote');
            
            // Clear messages after a delay
            setTimeout(function() {
                $("#voteSuccess").html("");
                $("#voteError").html("");
            }, 5000);
        });
    },
    
    registerAsVoter: function() {
        // Get form values
        const name = $("#voterName").val().trim();
        const idDocument = $("#idDocument").val().trim();
        
        // Form validation
        if (!name || !idDocument) {
            $("#registrationError").html("<div class='alert alert-danger'>Please fill in all registration fields</div>");
            return;
        }
        
        // Try to register voter
        try {
            if (App.contracts.VoterRegistry) {
                App.contracts.VoterRegistry.deployed().then(function(instance) {
                    // Hash the ID document client-side for privacy if web3.utils is available
                    let idHash = idDocument;
                    if (web3.utils && web3.utils.keccak256) {
                        idHash = web3.utils.keccak256(idDocument);
                    }
                    
                    // Submit registration transaction
                    return instance.registerVoter(name, idHash, { from: App.account });
                }).then(function(result) {
                    // Registration successful
                    $("#registrationSuccess").html("<div class='alert alert-success'>Your registration has been submitted. Please wait for verification.</div>");
                    
                    // Clear form
                    $("#voterName").val("");
                    $("#idDocument").val("");
                    
                    // Re-render the UI
                    App.render();
                }).catch(function(error) {
                    // Registration failed
                    console.error("Error registering voter:", error);
                    let errorMessage = "Failed to register. Please try again.";
                    
                    if (error.message && error.message.includes("already registered")) {
                        errorMessage = "You are already registered as a voter.";
                    }
                    
                    $("#registrationError").html("<div class='alert alert-danger'>" + errorMessage + "</div>");
                });
            } else {
                // Fall back to the basic Election contract if available
                App.contracts.Election.deployed().then(function(instance) {
                    if (instance.registerVoter) {
                        return instance.registerVoter(App.account, { from: App.account });
                    } else {
                        throw new Error("Voter registration not supported in the deployed contract");
                    }
                }).then(function(result) {
                    $("#registrationSuccess").html("<div class='alert alert-success'>Your registration has been submitted.</div>");
                    App.render();
                }).catch(function(error) {
                    console.error("Error with basic registration:", error);
                    $("#registrationError").html("<div class='alert alert-danger'>Registration failed: Voter registration not supported.</div>");
                });
            }
        } catch (error) {
            console.error("Error in registerAsVoter:", error);
            $("#registrationError").html("<div class='alert alert-danger'>Registration is not available at this time.</div>");
        }
        
        // Clear messages after a delay
        setTimeout(function() {
            $("#registrationSuccess").html("");
            $("#registrationError").html("");
        }, 5000);
    },

    // Add this function to render the chart visualization
    renderResultsChart: function(candidates, totalVotes) {
        const chartContainer = $("#resultsChart");
        chartContainer.empty();
        
        if (totalVotes === 0) {
            chartContainer.html("<p>No votes have been cast yet.</p>");
            return;
        }
        
        // Sort candidates by vote count in descending order
        candidates.sort((a, b) => b.voteCount - a.voteCount);
        
        // Create a bar chart
        candidates.forEach(function(candidate) {
            const percentage = totalVotes > 0 ? ((candidate.voteCount / totalVotes) * 100).toFixed(1) : 0;
            const height = Math.max(percentage, 5); // Minimum height of 5% for visibility
            
            const bar = $("<div>")
                .addClass("chart-bar")
                .css("height", height + "%")
                .attr("data-percentage", percentage + "%")
                .attr("title", candidate.name + ": " + candidate.voteCount + " votes (" + percentage + "%)");
            
            const label = $("<div>")
                .addClass("chart-label")
                .text(candidate.name);
            
            const chartColumn = $("<div>")
                .addClass("chart-column")
                .append(bar)
                .append(label);
            
            chartContainer.append(chartColumn);
        });
    }
};

$(function () {
    $(window).on('load', function () {
        App.init();
        
        // Set up event handlers
        $("#connectWalletBtn").click(function() {
            App.connectWallet();
        });
        
        $("#disconnectWalletBtn").click(function() {
            App.disconnectWallet();
        });
        
        $("#voteButton").click(function(event) {
            event.preventDefault();
            App.castVote();
        });
        
        $("#registerVoterButton").click(function(event) {
            event.preventDefault();
            App.registerAsVoter();
        });
    });
});

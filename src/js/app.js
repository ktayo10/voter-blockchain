App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',
  hasVoted: false,
  isConnected: false,
  candidatesData: [], // Store candidates data to avoid redundant fetching
  
  // Utility functions to reduce redundancy
  utils: {
    // Calculate total votes from candidate data
    calculateTotalVotes: function(candidates) {
      return candidates.reduce((total, candidate) => total + parseInt(candidate[2]), 0);
    },
    
    // Format percentage with consistent decimal places
    formatPercentage: function(value, total) {
      return total > 0 ? (value / total * 100).toFixed(1) + '%' : '0%';
    },
    
    // Show alert message in specified element
    showAlert: function(elementId, type, message) {
      $(`#${elementId}`).html(`<div class='alert alert-${type}'>${message}</div>`);
    },
    
    // Check if MetaMask is available
    isMetaMaskAvailable: function() {
      return typeof window.ethereum !== 'undefined';
    }
  },

  init: async function() {
    return await App.initWeb3();
  },

  initWeb3: async function() {
    // Check if user was previously connected
    const previouslyConnected = localStorage.getItem('walletConnected') === 'true';

    // First check if we have injected web3 (Mist/MetaMask)
    if (typeof window.ethereum !== 'undefined') {
      App.web3Provider = window.ethereum;
      web3 = new Web3(window.ethereum);
      
      // If previously connected, try to reconnect automatically
      if (previouslyConnected) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            App.account = accounts[0];
            App.isConnected = true;
            localStorage.setItem('walletConnected', 'true');
            
            // Update UI to show connected state
            App.updateConnectionUI(true);
          } else {
            App.isConnected = false;
            localStorage.removeItem('walletConnected');
            App.updateConnectionUI(false);
            
            // Show wallet prompt if not reconnected automatically
            setTimeout(App.showWalletPrompt, 1000);
          }
        } catch (error) {
          console.error("Error reconnecting to wallet", error);
          App.isConnected = false;
          localStorage.removeItem('walletConnected');
          App.updateConnectionUI(false);
          
          // Show wallet prompt if reconnect failed
          setTimeout(App.showWalletPrompt, 1000);
        }
      } else {
        App.updateConnectionUI(false);
        
        // Show wallet prompt for new users
        setTimeout(App.showWalletPrompt, 1000);
      }
      
      // Listen for account changes
      window.ethereum.on('accountsChanged', function (accounts) {
        if (accounts.length === 0) {
          // User disconnected wallet
          App.disconnectWallet();
        } else {
          App.account = accounts[0];
          App.loadBlockchainData();
        }
      });
    } else {
      // If no injected web3 instance is detected, fall back to Ganache
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
      web3 = new Web3(App.web3Provider);
      
      // This is read-only mode
      App.isConnected = false;
      App.updateConnectionUI(false);
      
      // Show a message that MetaMask is recommended
      $("#systemStatus").html("Read-only mode. Install MetaMask for full functionality");
      
      // Show MetaMask installation prompt
      setTimeout(App.showMetaMaskPrompt, 1000);
    }
    
    return App.initContract();
  },
  
  // Show wallet connection prompt (for initial page load)
  showWalletPrompt: function() {
    if (!App.isConnected) {
      // Create modal if it doesn't exist
      if ($('#walletPromptModal').length === 0) {
        App.createWalletPromptModal();
      }
      
      // Show the modal
      $('#walletPromptModal').modal('show');
    }
  },
  
  // Show MetaMask installation prompt
  showMetaMaskPrompt: function() {
    if ($('#metaMaskPromptModal').length === 0) {
      const bodyContent = `
        <div class="text-center mb-4">
          <img src="https://metamask.io/images/metamask-fox.svg" alt="MetaMask Logo" style="width: 80px; margin-bottom: 20px;">
          <p>MetaMask is required to participate in the voting process. Please install MetaMask to:</p>
          <ul class="text-left">
            <li>Create a secure blockchain wallet</li>
            <li>Connect to the blockchain network</li>
            <li>Cast your vote securely</li>
          </ul>
        </div>
      `;
      
      const buttons = [
        { text: 'Continue in Read-only Mode', type: 'secondary', dismiss: true },
        { text: 'Install MetaMask', type: 'primary', icon: 'download', url: 'https://metamask.io/download/' }
      ];
      
      const modalHtml = App.createModal('metaMaskPromptModal', 'Install MetaMask', bodyContent, buttons);
      $('body').append(modalHtml);
    }
    
    // Show the modal
    $('#metaMaskPromptModal').modal('show');
  },

  initContract: function() {
    $.getJSON('Election.json', function(election) {
      // Initialize contract
      App.contracts.Election = TruffleContract(election);
      // Connect provider to interact with contract
      App.contracts.Election.setProvider(App.web3Provider);

      // Set up event listeners once
      App.listenForEvents();
      
      // Initial render
      return App.loadBlockchainData();
    });
  },

  listenForEvents: function() {
    App.contracts.Election.deployed().then(function(instance) {
      // Listen only for new events, not historical ones
      instance.votedEvent({}, {
        fromBlock: 'latest',
        toBlock: 'latest'
      }).watch(function(error, event) {
        if (error) {
          console.error("Error in event listener:", error);
          return;
        }
        
        console.log("Vote event received:", event);
        // Only update the specific candidate that was voted for
        const candidateId = event.args._candidateId.toNumber();
        App.updateCandidateVote(candidateId);
      });
    }).catch(console.error);
  },

  // Function to update only a specific candidate's vote count
  updateCandidateVote: function(candidateId) {
    App.contracts.Election.deployed().then(async function(instance) {
      try {
        // Fetch the updated candidate data
        const candidate = await instance.candidates(candidateId);
        
        // Find the candidate in our local data and update it
        for (let i = 0; i < App.candidatesData.length; i++) {
          if (App.candidatesData[i][0].toNumber() === candidateId) {
            App.candidatesData[i] = candidate;
            break;
          }
        }
        
        // Recalculate total votes using utility function
        const totalVotes = App.utils.calculateTotalVotes(App.candidatesData);
        
        // Update only the necessary UI elements
        $("#totalVotes").text(totalVotes.toString());
        
        // Update the specific candidate row
        const voteCount = candidate[2].toString();
        const percentage = App.utils.formatPercentage(parseInt(voteCount), totalVotes);
        
        $(`#candidate-${candidateId} .vote-count`).text(voteCount);
        $(`#candidate-${candidateId} .vote-percentage`).text(percentage);
        
        // Update all percentages since total votes changed
        App.candidatesData.forEach(function(candidate) {
          const id = candidate[0].toNumber();
          const votes = parseInt(candidate[2]);
          const pct = App.utils.formatPercentage(votes, totalVotes);
          $(`#candidate-${id} .vote-percentage`).text(pct);
        });
        
        // Update chart visualization
        App.renderChart(App.candidatesData, totalVotes);
        
        // Check if current user has voted (if connected)
        if (App.isConnected) {
          const hasVoted = await instance.voters(App.account);
          if (hasVoted) {
            $("#voteForm").hide();
            App.utils.showAlert("voteMessage", "info", "You have already voted!");
          }
        }
        
      } catch (error) {
        console.error("Error updating candidate vote:", error);
      }
    }).catch(console.error);
  },

  // Separate data loading from UI rendering
  loadBlockchainData: function() {
    var loader = $("#loader");
    var content = $("#content");

    loader.show();
    content.hide();

    // Load account data if connected
    if (App.isConnected) {
      $("#accountAddress").html("Your Account: " + App.account);
    }

    App.contracts.Election.deployed().then(async function(instance) {
      const electionInstance = instance;
      
      try {
        // Get candidate count
        const candidatesCount = await electionInstance.candidatesCount();
        $("#candidateCount").text(candidatesCount.toString());
        
        // Fetch all candidates
        let promises = [];
        for (let i = 1; i <= candidatesCount; i++) {
          promises.push(electionInstance.candidates(i));
        }
        
        // Store candidates data for future reference
        App.candidatesData = await Promise.all(promises);
        
        // Render the UI with the data
        App.renderUI();
        
        // Check if user has already voted (if connected)
        if (App.isConnected) {
          const hasVoted = await electionInstance.voters(App.account);
          App.hasVoted = hasVoted;
          
          if (hasVoted) {
            $("#voteForm").hide();
            $("#voteMessage").html("<div class='alert alert-info'>You have already voted!</div>");
          } else {
            $("#voteForm").show();
            $("#voteMessage").html("");
          }
        } else {
          // Show connection required message if not connected
          $("#voteForm").hide();
          $("#voteMessage").html("<div class='alert alert-warning'>Connect your wallet to vote</div>");
        }
        
      } catch (error) {
        console.error("Error loading blockchain data:", error);
        $("#error").html("Error loading election data: " + error.message);
        $("#error").show();
      } finally {
        loader.hide();
        content.show();
      }
    }).catch(function(error) {
      console.error("Contract deployment error:", error);
      $("#error").html("Error connecting to the blockchain: " + error.message);
      $("#error").show();
      loader.hide();
    });
  },

  // Function to render UI elements from stored data
  renderUI: function() {
    // Clear existing UI elements
    const candidatesResults = $("#candidatesResults");
    const candidatesSelect = $('#candidatesSelect');
    const chartDiv = $("#resultsChart");
    
    candidatesResults.empty();
    candidatesSelect.empty();
    chartDiv.empty();
    
    // Add default option to select
    candidatesSelect.append("<option selected disabled value=''>Choose a candidate...</option>");
    
    // Calculate total votes using utility function
    const totalVotes = App.utils.calculateTotalVotes(App.candidatesData);
    
    // Update total votes in UI
    $("#totalVotes").text(totalVotes.toString());
    
    // Process each candidate
    App.candidatesData.forEach(function(candidate) {
      const id = candidate[0].toNumber();
      const name = candidate[1];
      const voteCount = candidate[2].toString();
      
      // Calculate percentage for display using utility function
      const percentage = App.utils.formatPercentage(parseInt(voteCount), totalVotes);

      // Render candidate Result - with unique ID for easy updates
      const candidateTemplate = `<tr id="candidate-${id}">
        <th>${id}</th>
        <td>${name}</td>
        <td class="vote-count">${voteCount}</td>
        <td class="vote-percentage">${percentage}</td>
      </tr>`;
      candidatesResults.append(candidateTemplate);

      // Render candidate ballot option
      const candidateOption = `<option value="${id}">${name}</option>`;
      candidatesSelect.append(candidateOption);
    });
    
    // Render chart visualization
    App.renderChart(App.candidatesData, totalVotes);
  },

  // Render a simple bar chart for vote visualization
  renderChart: function(candidates, totalVotes) {
    const chartDiv = $("#resultsChart");
    chartDiv.empty();
    
    candidates.forEach(function(candidate) {
      const name = candidate[1];
      const votes = parseInt(candidate[2]);
      const percentage = totalVotes > 0 ? (votes / totalVotes * 100) : 0;
      
      // Create a bar with the height based on percentage
      const bar = $("<div></div>")
        .addClass("chart-bar")
        .css("height", Math.max(percentage, 2) + "%")
        .attr("data-percentage", percentage.toFixed(1) + "%");
      
      // Add label below the bar
      const label = $("<div></div>")
        .addClass("chart-label")
        .text(name);
      
      // Wrap bar and label in a container
      const barContainer = $("<div></div>")
        .addClass("chart-bar-container")
        .append(bar)
        .append(label);
      
      chartDiv.append(barContainer);
    });
  },

  // Function to render a bar graph for vote distribution
  renderVoteDistributionGraph: function(candidates, totalVotes) {
    const ctx = document.getElementById('voteDistributionChart').getContext('2d');

    // Prepare data for the chart
    const labels = candidates.map(candidate => candidate[1]); // Candidate names
    const data = candidates.map(candidate => parseInt(candidate[2])); // Vote counts

    // Destroy existing chart instance if it exists
    if (App.voteChart) {
      App.voteChart.destroy();
    }

    // Create a new bar chart
    App.voteChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Votes',
          data: data,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Votes'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Candidates'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.raw} votes`;
              }
            }
          }
        }
      }
    });
  },

  castVote: function() {
    if (!App.isConnected) {
      App.utils.showAlert("voteMessage", "warning", "Please connect your wallet first");
      return;
    }
    
    var candidateId = $('#candidatesSelect').val();
    if (!candidateId) {
      App.utils.showAlert("voteMessage", "danger", "Please select a candidate!");
      return;
    }

    $("#voteButton").prop('disabled', true);
    App.utils.showAlert("voteMessage", "info", "Processing your vote... Please wait.");

    // Single transaction
    App.contracts.Election.deployed().then(function(instance) {
      return instance.vote(candidateId, { from: App.account });
    }).then(function(result) {
      console.log("Vote transaction successful", result);
      App.utils.showAlert("voteMessage", "success", "Your vote has been recorded! Your wallet will be disconnected in 5 seconds.");
      $("#voteForm").hide();
      
      // Mark user as having voted
      App.hasVoted = true;
      
      // Disconnect wallet after successful vote with countdown
      let countdown = 5;
      const countdownInterval = setInterval(function() {
        countdown--;
        App.utils.showAlert("voteMessage", "success", `Your vote has been recorded! Your wallet will be disconnected in ${countdown} seconds.`);
        
        if (countdown <= 0) {
          clearInterval(countdownInterval);
          App.disconnectWallet();
        }
      }, 1000);
      
    }).catch(function(err) {
      console.error("Error in vote transaction", err);
      $("#voteButton").prop('disabled', false);
      if (err.message.includes("revert")) {
        App.utils.showAlert("voteMessage", "danger", "You have already voted!");
      } else {
        App.utils.showAlert("voteMessage", "danger", "Error processing your vote. Please try again.");
      }
    });
  },

  // Consolidate wallet connection logic
  connectToWallet: async function(showSpinner = false) {
    if (!App.utils.isMetaMaskAvailable()) {
      return false;
    }
    
    if (showSpinner) {
      $("#modalConnectWalletBtn").prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Connecting...');
      $("#connectWalletBtn").prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Connecting...');
    }
    
    try {
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      App.account = accounts[0];
      App.isConnected = true;
      
      // Store connection status
      localStorage.setItem('walletConnected', 'true');
      
      // Update UI
      App.updateConnectionUI(true);
      
      // Load blockchain data
      App.loadBlockchainData();
      
      return true;
    } catch (error) {
      console.error("User denied account access", error);
      App.updateConnectionUI(false);
      
      if (showSpinner) {
        $("#connectWalletError").html("Please allow access to your MetaMask wallet.");
        $("#connectWalletBtn").prop('disabled', false).html('<i class="fas fa-wallet"></i> Connect Wallet');
        $("#modalConnectWalletBtn").prop('disabled', false).html('<i class="fas fa-wallet"></i> Connect Wallet');
      }
      
      return false;
    }
  },

  // Improved wallet connection logic
  connectWallet: async function() {
    console.log("Connect wallet button clicked");
    
    if (!App.utils.isMetaMaskAvailable()) {
      alert("MetaMask is not installed. Please install MetaMask to use this application.");
      return;
    }
    
    // Update UI to show connecting state
    App.updateConnectionUI(false, true);
    
    // Use shared connection logic
    const connected = await App.connectToWallet();
    
    if (!connected) {
      alert("Wallet connection failed. Please try again.");
    }
  },
  
  // Function to actually connect to the wallet after user confirms in the modal
  connectWalletAfterPrompt: async function() {
    if (!App.utils.isMetaMaskAvailable()) {
      $("#connectWalletError").html("Please install MetaMask to use all features.");
      return;
    }
    
    // Use shared connection logic with spinner
    await App.connectToWallet(true);
  },

  // Create reusable modal template function
  createModal: function(id, title, bodyContent, buttons, options = {}) {
    const headerClass = options.headerClass || 'bg-primary text-white';
    const titleIcon = options.titleIcon ? `<i class="fas fa-${options.titleIcon} mr-2"></i> ` : '';
    
    let buttonHtml = '';
    buttons.forEach(btn => {
      if (btn.url) {
        buttonHtml += `<a href="${btn.url}" target="_blank" class="btn btn-${btn.type}" id="${btn.id || ''}">
          ${btn.icon ? `<i class="fas fa-${btn.icon}"></i> ` : ''}${btn.text}
        </a>`;
      } else {
        buttonHtml += `<button type="button" class="btn btn-${btn.type}" id="${btn.id || ''}" ${btn.dismiss ? 'data-dismiss="modal"' : ''}>
          ${btn.icon ? `<i class="fas fa-${btn.icon}"></i> ` : ''}${btn.text}
        </button>`;
      }
    });
    
    return `
      <div class="modal fade" id="${id}" tabindex="-1" role="dialog" aria-labelledby="${id}Label" aria-hidden="true">
        <div class="modal-dialog" role="document">
          <div class="modal-content">
            <div class="modal-header ${headerClass}">
              <h5 class="modal-title" id="${id}Label">
                ${titleIcon}${title}
              </h5>
              <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div class="modal-body">
              ${bodyContent}
            </div>
            <div class="modal-footer">
              ${buttonHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // Create the wallet prompt modal dynamically
  createWalletPromptModal: function() {
    const bodyContent = `
      <div class="text-center mb-4">
        <i class="fas fa-wallet fa-3x text-primary mb-3"></i>
        <p>Connect your wallet to participate in the voting process. Your wallet is required to:</p>
        <ul class="text-left">
          <li>Verify your identity on the blockchain</li>
          <li>Cast your vote securely</li>
          <li>Ensure you can only vote once</li>
        </ul>
      </div>
    `;
    
    const buttons = [
      { text: 'Maybe Later', type: 'secondary', dismiss: true },
      { text: 'Connect Wallet', type: 'primary', id: 'modalConnectWalletBtn', icon: 'wallet' }
    ];
    
    const modalHtml = App.createModal('walletPromptModal', 'Connect Your Wallet', bodyContent, buttons);
    
    $('body').append(modalHtml);
    
    // Add click handler to the modal connect button
    $('#modalConnectWalletBtn').on('click', function() {
      console.log("Modal connect button clicked");
      $('#walletPromptModal').modal('hide');
      App.connectWalletAfterPrompt();
    });
  },
  
  // Show wallet disconnect notification
  showDisconnectNotification: function() {
    const bodyContent = `
      <div class="text-center mb-4">
        <i class="fas fa-unlink fa-3x text-dark mb-3"></i>
        <p>Your wallet has been disconnected from this application.</p>
        <p><strong>Note:</strong> This does not lock your MetaMask wallet. To lock MetaMask, you need to:</p>
        <ol class="text-left">
          <li>Click on the MetaMask icon in your browser</li>
          <li>Click on the account icon in the top-right corner</li>
          <li>Select "Lock" from the dropdown menu</li>
        </ol>
      </div>
    `;
    
    const buttons = [
      { text: 'Close', type: 'secondary', dismiss: true },
      { text: 'Reconnect Wallet', type: 'primary', id: 'modalReconnectWalletBtn', icon: 'link' }
    ];
    
    const options = {
      headerClass: 'bg-dark text-white',
      titleIcon: 'unlink'
    };
    
    // Create modal if it doesn't exist
    if ($('#walletDisconnectedModal').length === 0) {
      const modalHtml = App.createModal('walletDisconnectedModal', 'Wallet Disconnected', bodyContent, buttons, options);
      $('body').append(modalHtml);
      
      // Add click handler to the modal reconnect button
      $('#modalReconnectWalletBtn').on('click', function() {
        $('#walletDisconnectedModal').modal('hide');
        App.connectWallet();
      });
    }
    
    // Show the modal
    $('#walletDisconnectedModal').modal('show');
  },

  // Update UI based on connection state
  updateConnectionUI: function(isConnected, isConnecting = false) {
    if (isConnecting) {
      $("#connectWalletBtn").prop('disabled', true).text("Connecting...");
      return;
    }

    if (isConnected) {
      $("#walletSection").hide();
      $("#accountSection").show();
      $("#connectWalletError").html("");
      $("#accountAddress").html("Your Account: " + App.account);
      
      // Update system status
      $("#systemStatus").html("Connected to Blockchain");
      
      // Show voting section if connected
      $("#votingActions").show();
    } else {
      $("#walletSection").show();
      $("#accountSection").hide();
      $("#accountAddress").html("");
      
      // Update system status for read-only mode
      $("#systemStatus").html("Read-only mode. Connect wallet for full functionality");
      
      // Hide voting section if not connected
      $("#votingActions").hide();

      // Reset connect button
      $("#connectWalletBtn").prop('disabled', false).text("Connect Wallet");
    }
  },

  // Function to toggle themes dynamically
  toggleTheme: function(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  },

  // Initialize theme based on saved preference or default
  initializeTheme: function() {
    const savedTheme = localStorage.getItem('theme') || 'standard';
    App.toggleTheme(savedTheme);
  },

  // Add event listeners for theme toggle buttons
  setupThemeToggleButtons: function() {
    document.getElementById('themeStandard').addEventListener('click', function() {
      App.toggleTheme('standard');
    });
    document.getElementById('themeDark').addEventListener('click', function() {
      App.toggleTheme('dark');
    });
    document.getElementById('themeColorBlind').addEventListener('click', function() {
      App.toggleTheme('colorblind');
    });
    document.getElementById('themeDyslexic').addEventListener('click', function() {
      App.toggleTheme('dyslexic');
    });
  },

  // Ensure modal close buttons work
  setupModalCloseButtons: function() {
    // Close modal on 'x' button click
    $(document).on('click', '.modal .close', function() {
      $(this).closest('.modal').modal('hide');
    });

    // Close modal on 'Maybe Later' button click
    $(document).on('click', '.modal .btn-secondary', function() {
      $(this).closest('.modal').modal('hide');
    });
  },

  // Function to open MetaMask and allow account selection
  openMetaMask: async function() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        App.account = accounts[0];
        App.isConnected = true;

        // Store connection status
        localStorage.setItem('walletConnected', 'true');

        // Update UI to show connected state
        App.updateConnectionUI(true);

        // Load blockchain data
        App.loadBlockchainData();
      } catch (error) {
        console.error("User denied account access", error);
        alert("Please allow access to your MetaMask wallet to connect.");
      }
    } else {
      alert("MetaMask is not installed. Please install MetaMask to use this application.");
    }
  },

  // Add info button functionality
  setupInfoButton: function() {
    $(document).on('click', '#infoButton', function() {
      alert("To connect your wallet to the website:\n1. Ensure MetaMask is installed and unlocked.\n2. Click the 'Connect Wallet' button.\n3. Select the account you want to connect.\n4. Approve the connection in MetaMask.");
    });
  },
};

// Add theme switching functionality
function setTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName);
  localStorage.setItem('theme', themeName);
}

// Initialize theme
function initializeTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);
}

// Handle OS-level dark mode preference
function handleOSThemeChange(e) {
  const darkModeOn = e.matches;
  setTheme(darkModeOn ? 'dark' : 'light');
}

$(function() {
  $(window).on('load', function() {
    App.init();
    initializeTheme();

    // Listen for OS theme changes
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
    window.matchMedia('(prefers-color-scheme: dark)').addListener(handleOSThemeChange);

    // Add click handlers
    $('#connectWalletBtn').on('click', function() {
      App.connectWallet();
    });

    $('#disconnectWalletBtn').on('click', function() {
      App.disconnectWallet();
    });

    $('#voteButton').on('click', function() {
      App.castVote();
    });

    // Setup theme toggle buttons
    App.setupThemeToggleButtons();

    // Setup modal close buttons
    App.setupModalCloseButtons();

    // Setup info button
    App.setupInfoButton();
  });
});

App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',
  hasVoted: false,

  init: async function() {
    return await App.initWeb3();
  },

  initWeb3: async function() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        App.web3Provider = window.ethereum;
        web3 = new Web3(window.ethereum);
        App.account = accounts[0];
        
        // Listen for account changes
        window.ethereum.on('accountsChanged', function (accounts) {
          App.account = accounts[0];
          App.render();
        });
      } catch (error) {
        console.error("User denied account access");
      }
    } else {
      console.log('No ethereum browser detected. You should consider trying MetaMask!');
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
      web3 = new Web3(App.web3Provider);
    }
    return App.initContract();
  },

  initContract: function() {
    $.getJSON('Election.json', function(election) {
      // Initialize contract
      App.contracts.Election = TruffleContract(election);
      // Connect provider to interact with contract
      App.contracts.Election.setProvider(App.web3Provider);

      App.listenForEvents();

      return App.render();
    });
  },

  listenForEvents: function() {
    App.contracts.Election.deployed().then(function(instance) {
      // Restart Chrome if you are unable to receive this event
      // This is a known issue with MetaMask
      instance.votedEvent({}, {
        fromBlock: 0,
        toBlock: 'latest'
      }).watch(function(error, event) {
        console.log("event triggered", event)
        // Reload when a new vote is recorded
        App.render();
      });
    });
  },

  render: function() {
    var electionInstance;
    var loader = $("#loader");
    var content = $("#content");

    loader.show();
    content.hide();

    // Load account data
    if (App.account) {
      $("#accountAddress").html("Your Account: " + App.account);
    }

    // Load contract data
    App.contracts.Election.deployed().then(function(instance) {
      electionInstance = instance;
      return electionInstance.candidatesCount();
    }).then(function(candidatesCount) {
      var candidatesResults = $("#candidatesResults");
      candidatesResults.empty();

      var candidatesSelect = $('#candidatesSelect');
      candidatesSelect.empty();

      var promises = [];
      for (var i = 1; i <= candidatesCount; i++) {
        promises.push(electionInstance.candidates(i));
      }

      Promise.all(promises).then(function(candidates) {
        candidates.forEach(function(candidate) {
          var id = candidate[0];
          var name = candidate[1];
          var voteCount = candidate[2];

          // Render candidate Result
          var candidateTemplate = "<tr><th>" + id + "</th><td>" + name + "</td><td>" + voteCount + "</td></tr>";
          candidatesResults.append(candidateTemplate);

          // Render candidate ballot option
          var candidateOption = "<option value='" + id + "'>" + name + "</option>";
          candidatesSelect.append(candidateOption);
        });
        return electionInstance.voters(App.account);
      }).then(function(hasVoted) {
        // Do not allow a user to vote
        if(hasVoted) {
          $('form').hide();
          $("#voteMessage").html("<div class='alert alert-info'>You have already voted!</div>");
        }
        loader.hide();
        content.show();
      });
    }).catch(function(error) {
      console.warn(error);
      loader.hide();
    });
  },

  castVote: function() {
    var candidateId = $('#candidatesSelect').val();
    if (!candidateId) {
      $("#voteMessage").html("<div class='alert alert-danger'>Please select a candidate!</div>");
      return;
    }

    $("#voteButton").prop('disabled', true);
    $("#voteMessage").html("<div class='alert alert-info'>Processing your vote... Please wait.</div>");

    App.contracts.Election.deployed().then(function(instance) {
      return instance.vote(candidateId, { from: App.account });
    }).then(function(result) {
      $("#voteMessage").html("<div class='alert alert-success'>Your vote has been recorded!</div>");
      $("#content").hide();
      $("#loader").show();
    }).catch(function(err) {
      $("#voteButton").prop('disabled', false);
      if (err.message.includes("revert")) {
        $("#voteMessage").html("<div class='alert alert-danger'>You have already voted!</div>");
      } else {
        $("#voteMessage").html("<div class='alert alert-danger'>Error processing your vote. Please try again.</div>");
      }
      console.error(err);
    });
  }
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
    $('#connectWalletBtn').on('click', async function() {
      if (typeof window.ethereum !== 'undefined') {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          App.account = accounts[0];
          $("#walletSection").hide();
          $("#accountSection").show();
          App.render();
        } catch (error) {
          console.error("User denied account access");
          $("#connectWalletError").html("Please allow access to your MetaMask wallet.");
        }
      } else {
        $("#connectWalletError").html("Please install MetaMask to use this application.");
      }
    });

    $('#voteButton').on('click', function() {
      App.castVote();
    });
  });
});

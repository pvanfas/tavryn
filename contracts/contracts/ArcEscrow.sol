// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title ArcEscrow
 * @notice Autonomous procurement escrow with deterministic on-chain spending limits,
 * category budgets, multi-role authority separation (Owner, Agent, Verifier), and deadline refunds.
 */
contract ArcEscrow {
    enum Status {
        Created,
        Funded,
        MilestoneSubmitted,
        MilestoneApproved,
        Released,
        Refunded
    }

    struct Agreement {
        uint256 id;
        address depositor;
        address vendor;
        uint256 amount;
        string category;
        uint256 deadline;
        Status status;
        string milestoneDescription;
        uint256 createdAt;
    }

    IERC20 public immutable usdcToken;
    address public owner;
    address public agent;
    address public verifier;

    uint256 public maxPerAgreement; // In USDC units (6 decimals)
    mapping(string => uint256) public categoryBudgets;
    mapping(string => uint256) public categorySpent;

    uint256 public nextAgreementId = 1;
    mapping(uint256 => Agreement) public agreements;

    bool private _locked;

    // Events
    event AgreementCreated(
        uint256 indexed agreementId,
        address indexed depositor,
        address indexed vendor,
        uint256 amount,
        string category,
        uint256 deadline
    );
    event AgreementFunded(uint256 indexed agreementId, uint256 amount);
    event MilestoneSubmitted(uint256 indexed agreementId, string description);
    event MilestoneApproved(uint256 indexed agreementId, address indexed verifier);
    event FundsReleased(uint256 indexed agreementId, address indexed vendor, uint256 amount);
    event FundsRefunded(uint256 indexed agreementId, address indexed depositor, uint256 amount);
    event PolicyUpdated(uint256 maxPerAgreement);
    event CategoryBudgetUpdated(string category, uint256 budget);
    event RolesUpdated(address owner, address agent, address verifier);

    modifier onlyOwner() {
        require(msg.sender == owner, "ArcEscrow: Only owner authorized");
        _;
    }

    modifier onlyAgentOrOwner() {
        require(
            msg.sender == agent || msg.sender == owner,
            "ArcEscrow: Only agent or owner authorized"
        );
        _;
    }

    modifier onlyVerifier() {
        require(msg.sender == verifier, "ArcEscrow: Only verifier authorized");
        _;
    }

    modifier nonReentrant() {
        require(!_locked, "ArcEscrow: Reentrancy guard triggered");
        _locked = true;
        _;
        _locked = false;
    }

    constructor(
        address _usdcToken,
        address _agent,
        address _verifier,
        uint256 _maxPerAgreement
    ) {
        require(_usdcToken != address(0), "Invalid USDC address");
        usdcToken = IERC20(_usdcToken);
        owner = msg.sender;
        agent = _agent;
        verifier = _verifier;
        maxPerAgreement = _maxPerAgreement;
    }

    function setRoles(address _owner, address _agent, address _verifier) external onlyOwner {
        if (_owner != address(0)) owner = _owner;
        if (_agent != address(0)) agent = _agent;
        if (_verifier != address(0)) verifier = _verifier;
        emit RolesUpdated(owner, agent, verifier);
    }

    function setMaxPerAgreement(uint256 _max) external onlyOwner {
        maxPerAgreement = _max;
        emit PolicyUpdated(_max);
    }

    function setCategoryBudget(string calldata category, uint256 budget) external onlyOwner {
        categoryBudgets[category] = budget;
        emit CategoryBudgetUpdated(category, budget);
    }

    function createAgreement(
        address vendor,
        uint256 amount,
        string calldata category,
        uint256 durationSeconds
    ) external onlyAgentOrOwner returns (uint256) {
        require(vendor != address(0), "Invalid vendor address");
        require(amount > 0, "Amount must be positive");
        require(durationSeconds > 0, "Duration must be positive");

        // Policy rule: If initiated by agent, amount cannot exceed maxPerAgreement
        if (msg.sender == agent) {
            require(amount <= maxPerAgreement, "ArcEscrow: Amount exceeds agent policy cap");
            if (categoryBudgets[category] > 0) {
                require(
                    categorySpent[category] + amount <= categoryBudgets[category],
                    "ArcEscrow: Exceeds category budget"
                );
            }
        }

        uint256 agreementId = nextAgreementId++;
        uint256 deadline = block.timestamp + durationSeconds;

        agreements[agreementId] = Agreement({
            id: agreementId,
            depositor: msg.sender,
            vendor: vendor,
            amount: amount,
            category: category,
            deadline: deadline,
            status: Status.Created,
            milestoneDescription: "",
            createdAt: block.timestamp
        });

        categorySpent[category] += amount;

        emit AgreementCreated(agreementId, msg.sender, vendor, amount, category, deadline);
        return agreementId;
    }

    function fundAgreement(uint256 agreementId) external nonReentrant {
        Agreement storage ag = agreements[agreementId];
        require(ag.status == Status.Created, "ArcEscrow: Agreement not in Created status");
        require(
            msg.sender == ag.depositor || msg.sender == owner || msg.sender == agent,
            "ArcEscrow: Unauthorized funder"
        );

        ag.status = Status.Funded;

        bool success = usdcToken.transferFrom(msg.sender, address(this), ag.amount);
        require(success, "ArcEscrow: USDC transferFrom failed");

        emit AgreementFunded(agreementId, ag.amount);
    }

    function submitMilestone(uint256 agreementId, string calldata description) external {
        Agreement storage ag = agreements[agreementId];
        require(ag.status == Status.Funded, "ArcEscrow: Agreement must be funded");
        require(
            msg.sender == ag.vendor || msg.sender == ag.depositor || msg.sender == agent,
            "ArcEscrow: Unauthorized submitter"
        );

        ag.status = Status.MilestoneSubmitted;
        ag.milestoneDescription = description;

        emit MilestoneSubmitted(agreementId, description);
    }

    function approveMilestone(uint256 agreementId) external onlyVerifier {
        Agreement storage ag = agreements[agreementId];
        require(ag.status == Status.MilestoneSubmitted, "ArcEscrow: Milestone not submitted");
        require(msg.sender != agent, "ArcEscrow: Agent cannot approve its own milestone");

        ag.status = Status.MilestoneApproved;

        emit MilestoneApproved(agreementId, msg.sender);
    }

    function release(uint256 agreementId) external nonReentrant {
        Agreement storage ag = agreements[agreementId];
        require(ag.status == Status.MilestoneApproved, "ArcEscrow: Milestone must be approved");

        ag.status = Status.Released;

        bool success = usdcToken.transfer(ag.vendor, ag.amount);
        require(success, "ArcEscrow: USDC transfer to vendor failed");

        emit FundsReleased(agreementId, ag.vendor, ag.amount);
    }

    function refund(uint256 agreementId) external nonReentrant {
        Agreement storage ag = agreements[agreementId];
        require(
            ag.status == Status.Funded || ag.status == Status.MilestoneSubmitted,
            "ArcEscrow: Ineligible for refund"
        );
        require(block.timestamp > ag.deadline, "ArcEscrow: Deadline has not passed");

        ag.status = Status.Refunded;

        if (categorySpent[ag.category] >= ag.amount) {
            categorySpent[ag.category] -= ag.amount;
        }

        bool success = usdcToken.transfer(ag.depositor, ag.amount);
        require(success, "ArcEscrow: USDC refund failed");

        emit FundsRefunded(agreementId, ag.depositor, ag.amount);
    }

    function getAgreement(uint256 agreementId) external view returns (Agreement memory) {
        return agreements[agreementId];
    }
}

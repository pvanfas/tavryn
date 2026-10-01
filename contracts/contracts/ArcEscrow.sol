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
 * category budgets, multi-role authority separation (Owner, Agent, Verifier), deadline refunds,
 * and on-chain protocol success fees calculated strictly on realized savings.
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
        uint256 baselinePrice;
        uint256 savings;
        uint256 feeAmount;
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

    // Protocol success fee config (basis points: 1000 = 10%, max 2000 = 20%)
    uint256 public constant MAX_FEE_BPS = 2000;
    uint256 public feeBps;
    address public feeRecipient;

    uint256 public maxPerAgreement; // In USDC units (6 decimals)
    mapping(string => uint256) public categoryBudgets;
    mapping(string => uint256) public categorySpent;

    uint256 public nextAgreementId = 1;
    mapping(uint256 => Agreement) public agreements;
    mapping(bytes32 => uint256) public agreementByIdempotencyKey;

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
    event FeeCollected(uint256 indexed agreementId, address indexed recipient, uint256 feeAmount);
    event FundsRefunded(uint256 indexed agreementId, address indexed depositor, uint256 amount);
    event PolicyUpdated(uint256 maxPerAgreement);
    event CategoryBudgetUpdated(string category, uint256 budget);
    event RolesUpdated(address owner, address agent, address verifier);
    event FeeConfigUpdated(uint256 feeBps, address feeRecipient);

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
        require(_agent != address(0), "Invalid agent address");
        require(_verifier != address(0), "Invalid verifier address");
        require(_verifier != _agent, "ArcEscrow: Verifier cannot be agent");
        usdcToken = IERC20(_usdcToken);
        owner = msg.sender;
        agent = _agent;
        verifier = _verifier;
        maxPerAgreement = _maxPerAgreement;
        feeRecipient = msg.sender;
        feeBps = 0; // Default 0% until owner configures
    }

    function setRoles(address _owner, address _agent, address _verifier) external onlyOwner {
        if (_owner != address(0)) owner = _owner;
        if (_agent != address(0)) agent = _agent;
        if (_verifier != address(0)) verifier = _verifier;
        require(verifier != agent, "ArcEscrow: Verifier cannot be agent");
        emit RolesUpdated(owner, agent, verifier);
    }

    function setFeeConfig(uint256 _feeBps, address _feeRecipient) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "ArcEscrow: feeBps exceeds MAX_FEE_BPS");
        feeBps = _feeBps;
        if (_feeRecipient != address(0)) {
            feeRecipient = _feeRecipient;
        }
        emit FeeConfigUpdated(_feeBps, feeRecipient);
    }

    function setMaxPerAgreement(uint256 _max) external onlyOwner {
        maxPerAgreement = _max;
        emit PolicyUpdated(_max);
    }

    function setCategoryBudget(string calldata category, uint256 budget) external onlyOwner {
        categoryBudgets[category] = budget;
        emit CategoryBudgetUpdated(category, budget);
    }

    function _createAgreementInternal(
        address vendor,
        uint256 amount,
        uint256 baselinePrice,
        string calldata category,
        uint256 durationSeconds,
        bytes32 idempotencyKey
    ) internal returns (uint256) {
        require(vendor != address(0), "Invalid vendor address");
        require(amount > 0, "Amount must be positive");
        require(durationSeconds > 0, "Duration must be positive");

        if (idempotencyKey != bytes32(0)) {
            require(
                agreementByIdempotencyKey[idempotencyKey] == 0,
                "ArcEscrow: Idempotent agreement already exists"
            );
        }

        uint256 savings = baselinePrice > amount ? (baselinePrice - amount) : 0;
        uint256 feeAmount = (savings > 0 && feeBps > 0 && feeRecipient != address(0))
            ? (savings * feeBps) / 10000
            : 0;
        uint256 totalDeposit = amount + feeAmount;

        // Policy rule: If initiated by agent or any non-owner, total deposit cannot exceed maxPerAgreement
        if (msg.sender != owner) {
            require(totalDeposit <= maxPerAgreement, "ArcEscrow: Amount exceeds agent policy cap");
            if (categoryBudgets[category] > 0) {
                require(
                    categorySpent[category] + totalDeposit <= categoryBudgets[category],
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
            baselinePrice: baselinePrice,
            savings: savings,
            feeAmount: feeAmount,
            category: category,
            deadline: deadline,
            status: Status.Created,
            milestoneDescription: "",
            createdAt: block.timestamp
        });

        if (idempotencyKey != bytes32(0)) {
            agreementByIdempotencyKey[idempotencyKey] = agreementId;
        }

        categorySpent[category] += totalDeposit;

        emit AgreementCreated(agreementId, msg.sender, vendor, amount, category, deadline);
        return agreementId;
    }

    function createAgreement(
        address vendor,
        uint256 amount,
        string calldata category,
        uint256 durationSeconds
    ) external onlyAgentOrOwner returns (uint256) {
        return _createAgreementInternal(vendor, amount, amount, category, durationSeconds, bytes32(0));
    }

    function createAgreementWithIdempotency(
        address vendor,
        uint256 amount,
        string calldata category,
        uint256 durationSeconds,
        bytes32 idempotencyKey
    ) external onlyAgentOrOwner returns (uint256) {
        return _createAgreementInternal(vendor, amount, amount, category, durationSeconds, idempotencyKey);
    }

    function createAgreementWithSavings(
        address vendor,
        uint256 amount,
        uint256 baselinePrice,
        string calldata category,
        uint256 durationSeconds,
        bytes32 idempotencyKey
    ) external onlyAgentOrOwner returns (uint256) {
        return _createAgreementInternal(vendor, amount, baselinePrice, category, durationSeconds, idempotencyKey);
    }

    function fundAgreement(uint256 agreementId) external nonReentrant {
        Agreement storage ag = agreements[agreementId];
        require(ag.status == Status.Created, "ArcEscrow: Agreement not in Created status");
        require(
            msg.sender == ag.depositor || msg.sender == owner || msg.sender == agent,
            "ArcEscrow: Unauthorized funder"
        );

        ag.status = Status.Funded;
        uint256 totalDeposit = ag.amount + ag.feeAmount;

        bool success = usdcToken.transferFrom(msg.sender, address(this), totalDeposit);
        require(success, "ArcEscrow: USDC transferFrom failed");

        emit AgreementFunded(agreementId, totalDeposit);
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

        // 1. Release vendor payment
        bool success = usdcToken.transfer(ag.vendor, ag.amount);
        require(success, "ArcEscrow: USDC transfer to vendor failed");

        emit FundsReleased(agreementId, ag.vendor, ag.amount);

        // 2. Release protocol success fee to feeRecipient if applicable
        if (ag.feeAmount > 0 && feeRecipient != address(0)) {
            bool feeSuccess = usdcToken.transfer(feeRecipient, ag.feeAmount);
            require(feeSuccess, "ArcEscrow: USDC transfer of fee failed");
            emit FeeCollected(agreementId, feeRecipient, ag.feeAmount);
        }
    }

    function refund(uint256 agreementId) external nonReentrant {
        Agreement storage ag = agreements[agreementId];
        require(
            ag.status == Status.Funded || ag.status == Status.MilestoneSubmitted,
            "ArcEscrow: Ineligible for refund"
        );
        require(block.timestamp > ag.deadline, "ArcEscrow: Deadline has not passed");

        ag.status = Status.Refunded;
        uint256 totalToRefund = ag.amount + ag.feeAmount;

        if (categorySpent[ag.category] >= totalToRefund) {
            categorySpent[ag.category] -= totalToRefund;
        }

        bool success = usdcToken.transfer(ag.depositor, totalToRefund);
        require(success, "ArcEscrow: USDC refund failed");

        emit FundsRefunded(agreementId, ag.depositor, totalToRefund);
    }

    function getAgreement(uint256 agreementId) external view returns (Agreement memory) {
        return agreements[agreementId];
    }
}

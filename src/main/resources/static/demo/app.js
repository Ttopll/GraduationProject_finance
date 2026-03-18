const STORAGE_KEYS = {
    token: "finance-demo-token",
    familyId: "finance-demo-family-id",
    memberId: "finance-demo-member-id",
    month: "finance-demo-month",
    trendMonths: "finance-demo-trend-months"
};

const state = {
    token: null,
    user: null,
    memberships: [],
    families: [],
    members: [],
    accounts: [],
    categories: [],
    dashboard: null,
    transactions: [],
    debts: [],
    repayments: [],
    rules: [],
    billImportBatches: [],
    billParseRules: [],
    pendingItems: [],
    notifications: [],
    lastRuleEvaluation: null,
    lastBillImportResult: null,
    billImportBatchError: null,
    billParseRuleError: null,
    billPendingError: null,
    selectedFamilyId: null,
    selectedMemberId: null,
    selectedRepaymentDebtId: null,
    month: currentMonthText(),
    trendMonths: 6,
    loading: false
};

const refs = {};

document.addEventListener("DOMContentLoaded", () => {
    cacheRefs();
    bindEvents();
    hydrateState();
    renderAll();
    if (state.token) {
        loadWorkspace("已恢复本地会话。").catch(handleAsyncError);
    }
});

function cacheRefs() {
    const ids = [
        "loginForm",
        "loginButton",
        "usernameInput",
        "passwordInput",
        "refreshButton",
        "logoutButton",
        "systemStatus",
        "flashMessage",
        "familySelect",
        "memberSelect",
        "monthInput",
        "trendMonthsSelect",
        "sessionSummary",
        "overviewCards",
        "assetCards",
        "indicatorList",
        "expenseStructureList",
        "trendList",
        "budgetList",
        "transactionForm",
        "transactionRecordId",
        "transactionTypeSelect",
        "transactionAccountSelect",
        "transactionTargetField",
        "transactionTargetAccountSelect",
        "transactionCategorySelect",
        "transactionCreatorSelect",
        "transactionAmountInput",
        "transactionTimeInput",
        "transactionMerchantInput",
        "transactionCounterpartyInput",
        "transactionSourcePlatformInput",
        "transactionNoteInput",
        "transactionSubmitText",
        "transactionResetButton",
        "transactionTableBody",
        "debtForm",
        "debtIdInput",
        "debtNameInput",
        "debtTypeSelect",
        "debtDebtorSelect",
        "debtLenderInput",
        "debtPrincipalInput",
        "debtRateInput",
        "debtBillingDayInput",
        "debtRepaymentDayInput",
        "debtDueDateInput",
        "debtRemarkInput",
        "debtSubmitText",
        "debtResetButton",
        "repaymentForm",
        "repaymentDebtSelect",
        "repaymentAccountSelect",
        "repaymentCreatorSelect",
        "repaymentAmountInput",
        "repaymentPrincipalInput",
        "repaymentInterestInput",
        "repaymentTimeInput",
        "repaymentNoteInput",
        "debtCardList",
        "repaymentHistory",
        "ruleForm",
        "ruleNameInput",
        "ruleTypeSelect",
        "ruleMetricTypeSelect",
        "ruleCategoryField",
        "ruleCategorySelect",
        "ruleTimeScopeSelect",
        "ruleOperatorSelect",
        "ruleThresholdInput",
        "ruleWindowField",
        "ruleWindowLabel",
        "ruleWindowInput",
        "ruleCreatorSelect",
        "rulePriorityInput",
        "ruleMessageTemplateInput",
        "ruleSubmitButton",
        "ruleResetButton",
        "evaluateRulesButton",
        "ruleEvaluateSummary",
        "ruleList",
        "billImportAccountSelect",
        "billImportUploaderSelect",
        "importSampleOneButton",
        "importSampleTwoButton",
        "billFileInput",
        "uploadBillFileButton",
        "refreshBillImportButton",
        "billImportSummary",
        "billImportBatchList",
        "billParseRuleForm",
        "billParseKeywordInput",
        "billParseCategorySelect",
        "billParsePriorityInput",
        "billPendingList",
        "billParseRuleList",
        "refreshNotificationsButton",
        "notificationList",
        "workspaceControls"
    ];

    for (const id of ids) {
        refs[id] = document.getElementById(id);
    }
}

function bindEvents() {
    refs.loginForm.addEventListener("submit", onLoginSubmit);
    refs.refreshButton.addEventListener("click", () => loadWorkspace("已刷新当前家庭数据。").catch(handleAsyncError));
    refs.logoutButton.addEventListener("click", onLogout);
    refs.familySelect.addEventListener("change", onFamilyChange);
    refs.memberSelect.addEventListener("change", onMemberChange);
    refs.monthInput.addEventListener("change", onMonthChange);
    refs.trendMonthsSelect.addEventListener("change", onTrendMonthsChange);
    refs.transactionTypeSelect.addEventListener("change", onTransactionTypeChange);
    refs.transactionForm.addEventListener("submit", onTransactionSubmit);
    refs.transactionResetButton.addEventListener("click", resetTransactionForm);
    refs.transactionTableBody.addEventListener("click", onTransactionTableClick);
    refs.debtForm.addEventListener("submit", onDebtSubmit);
    refs.debtResetButton.addEventListener("click", resetDebtForm);
    refs.debtCardList.addEventListener("click", onDebtCardClick);
    refs.repaymentDebtSelect.addEventListener("change", onRepaymentDebtChange);
    refs.repaymentForm.addEventListener("submit", onRepaymentSubmit);
    refs.ruleTypeSelect.addEventListener("change", onRuleTypeChange);
    refs.ruleMetricTypeSelect.addEventListener("change", onRuleMetricTypeChange);
    refs.ruleForm.addEventListener("submit", onRuleSubmit);
    refs.ruleResetButton.addEventListener("click", resetRuleForm);
    refs.evaluateRulesButton.addEventListener("click", onEvaluateRules);
    refs.importSampleOneButton.addEventListener("click", () => onImportSample("/demo/samples/bill_import_sample_round1.csv", "样例一"));
    refs.importSampleTwoButton.addEventListener("click", () => onImportSample("/demo/samples/bill_import_sample_round2.csv", "样例二"));
    refs.uploadBillFileButton.addEventListener("click", onUploadBillFile);
    refs.refreshBillImportButton.addEventListener("click", onRefreshBillImport);
    refs.billParseRuleForm.addEventListener("submit", onBillParseRuleSubmit);
    refs.billPendingList.addEventListener("click", onBillPendingListClick);
    refs.refreshNotificationsButton.addEventListener("click", onRefreshNotifications);
    refs.notificationList.addEventListener("click", onNotificationListClick);
}

function hydrateState() {
    state.token = localStorage.getItem(STORAGE_KEYS.token);
    state.selectedFamilyId = parseStoredNumber(localStorage.getItem(STORAGE_KEYS.familyId));
    state.selectedMemberId = parseStoredNumber(localStorage.getItem(STORAGE_KEYS.memberId));
    state.month = localStorage.getItem(STORAGE_KEYS.month) || currentMonthText();
    state.trendMonths = parseStoredNumber(localStorage.getItem(STORAGE_KEYS.trendMonths)) || 6;

    refs.monthInput.value = state.month;
    refs.trendMonthsSelect.value = String(state.trendMonths);
    refs.transactionTimeInput.value = currentDateTimeLocal();
    refs.repaymentTimeInput.value = currentDateTimeLocal();
    refs.transactionSourcePlatformInput.value = "MANUAL";
    refs.billParsePriorityInput.value = "10";
    resetRuleForm();
}

async function onLoginSubmit(event) {
    event.preventDefault();

    const username = refs.usernameInput.value.trim();
    const password = refs.passwordInput.value;
    if (!username || !password) {
        setFlash("请输入用户名和密码。", "warning");
        return;
    }

    await withLoading("正在登录并拉取会话信息...", async () => {
        const response = await api("/api/auth/login", {
            method: "POST",
            auth: false,
            body: { username, password }
        });

        state.token = response.accessToken;
        localStorage.setItem(STORAGE_KEYS.token, state.token);
        refs.passwordInput.value = "";
        await loadWorkspace("登录成功，演示数据已载入。", false, response);
    }).catch(handleAsyncError);
}

async function loadWorkspace(successMessage, showLoading = true, loginResponse = null) {
    const runner = async () => {
        if (loginResponse) {
            state.user = loginResponse.user;
            state.memberships = loginResponse.memberships || [];
        } else {
            const me = await api("/api/auth/me");
            state.user = me.user;
            state.memberships = me.memberships || [];
        }

        state.families = await api("/api/families");
        resolveSelectedFamily();
        await refreshFamilyScopedData();
        if (successMessage) {
            setFlash(successMessage, "success");
        }
    };

    if (showLoading) {
        await withLoading("正在同步家庭和业务数据...", runner);
        return;
    }
    await runner();
}

async function refreshFamilyScopedData() {
    if (!state.selectedFamilyId) {
        state.members = [];
        state.accounts = [];
        state.categories = [];
        state.dashboard = null;
        state.transactions = [];
        state.debts = [];
        state.repayments = [];
        state.rules = [];
        state.billImportBatches = [];
        state.billParseRules = [];
        state.pendingItems = [];
        state.notifications = [];
        state.lastRuleEvaluation = null;
        state.lastBillImportResult = null;
        state.billImportBatchError = null;
        state.billParseRuleError = null;
        state.billPendingError = null;
        renderAll();
        return;
    }

    const familyId = state.selectedFamilyId;
    const query = new URLSearchParams({
        familyId: String(familyId),
        month: state.month,
        trendMonths: String(state.trendMonths)
    });

    const [members, accounts, categories, dashboard, transactions, debts, rules, notifications] = await Promise.all([
        api(`/api/families/${familyId}/members`),
        api(`/api/accounts?familyId=${familyId}`),
        api(`/api/categories?familyId=${familyId}`),
        api(`/api/financial-analysis/dashboard?${query.toString()}`),
        api(`/api/transaction-records?familyId=${familyId}`),
        api(`/api/debts?familyId=${familyId}`),
        api(`/api/rules?familyId=${familyId}`),
        api(`/api/notifications?familyId=${familyId}`)
    ]);

    state.members = members || [];
    state.accounts = accounts || [];
    state.categories = categories || [];
    state.dashboard = dashboard;
    state.transactions = (transactions || []).slice().sort(sortTransactionsDesc);
    state.debts = debts || [];
    state.rules = rules || [];
    state.notifications = notifications || [];
    state.lastRuleEvaluation = null;

    resolveSelectedMember();
    syncRepaymentDebtSelection();
    await refreshRepaymentsIfNeeded();
    await refreshBillImportWorkspace(false);
    renderAll();
}

async function refreshRepaymentsIfNeeded() {
    if (!state.selectedRepaymentDebtId) {
        state.repayments = [];
        return;
    }
    state.repayments = await api(`/api/debts/${state.selectedRepaymentDebtId}/repayments`);
}

function resolveSelectedFamily() {
    if (!state.families.length) {
        state.selectedFamilyId = null;
        localStorage.removeItem(STORAGE_KEYS.familyId);
        return;
    }

    const familyExists = state.families.some((family) => family.id === state.selectedFamilyId);
    if (familyExists) {
        return;
    }

    const membership = state.memberships.find((item) => item.status === 1);
    state.selectedFamilyId = membership?.familyId || state.families[0].id;
    persistNumber(STORAGE_KEYS.familyId, state.selectedFamilyId);
}

function resolveSelectedMember() {
    const memberExists = state.members.some((member) => member.memberId === state.selectedMemberId);
    if (memberExists) {
        return;
    }

    const ownMembership = state.memberships.find((membership) => membership.familyId === state.selectedFamilyId);
    state.selectedMemberId = ownMembership?.familyMemberId || state.members[0]?.memberId || null;
    persistNumber(STORAGE_KEYS.memberId, state.selectedMemberId);
}

function syncRepaymentDebtSelection() {
    const debtExists = state.debts.some((debt) => debt.id === state.selectedRepaymentDebtId);
    if (debtExists) {
        return;
    }
    state.selectedRepaymentDebtId = state.debts[0]?.id || null;
}

async function onFamilyChange(event) {
    state.selectedFamilyId = parseStoredNumber(event.target.value);
    persistNumber(STORAGE_KEYS.familyId, state.selectedFamilyId);
    state.selectedMemberId = null;
    state.selectedRepaymentDebtId = null;
    state.lastBillImportResult = null;
    await withLoading("正在切换家庭上下文...", refreshFamilyScopedData).catch(handleAsyncError);
}

function onMemberChange(event) {
    state.selectedMemberId = parseStoredNumber(event.target.value);
    persistNumber(STORAGE_KEYS.memberId, state.selectedMemberId);
    renderSessionSummary();
    populateMemberSelects();
}

async function onMonthChange(event) {
    state.month = event.target.value || currentMonthText();
    localStorage.setItem(STORAGE_KEYS.month, state.month);
    await withLoading("正在刷新分析看板...", refreshFamilyScopedData).catch(handleAsyncError);
}

async function onTrendMonthsChange(event) {
    state.trendMonths = parseStoredNumber(event.target.value) || 6;
    persistNumber(STORAGE_KEYS.trendMonths, state.trendMonths);
    await withLoading("正在刷新趋势窗口...", refreshFamilyScopedData).catch(handleAsyncError);
}

function onTransactionTypeChange() {
    populateCategorySelect(refs.transactionCategorySelect, refs.transactionTypeSelect.value, refs.transactionCategorySelect.value);
    toggleTransactionTargetField();
}

async function onTransactionSubmit(event) {
    event.preventDefault();
    if (!state.selectedFamilyId) {
        setFlash("请先选择家庭。", "warning");
        return;
    }

    const recordId = parseStoredNumber(refs.transactionRecordId.value);
    const payload = {
        accountId: parseRequiredNumber(refs.transactionAccountSelect.value, "请选择主账户"),
        targetAccountId: normalizeNullableNumber(refs.transactionTargetAccountSelect.value),
        categoryId: normalizeNullableNumber(refs.transactionCategorySelect.value),
        createdByMemberId: normalizeNullableNumber(refs.transactionCreatorSelect.value),
        transactionType: refs.transactionTypeSelect.value,
        amount: parseRequiredDecimal(refs.transactionAmountInput.value, "请输入合法金额"),
        transactionTime: parseRequiredDateTime(refs.transactionTimeInput.value, "请选择交易时间"),
        merchantName: normalizeText(refs.transactionMerchantInput.value),
        counterpartyName: normalizeText(refs.transactionCounterpartyInput.value),
        sourcePlatform: normalizeText(refs.transactionSourcePlatformInput.value),
        note: normalizeText(refs.transactionNoteInput.value)
    };

    if (payload.transactionType !== "TRANSFER") {
        payload.targetAccountId = null;
    }
    if (payload.transactionType === "TRANSFER") {
        payload.categoryId = null;
    }

    await withLoading(recordId ? "正在更新交易流水..." : "正在新增交易流水...", async () => {
        if (recordId) {
            await api(`/api/transaction-records/${recordId}`, {
                method: "PUT",
                body: payload
            });
        } else {
            await api("/api/transaction-records", {
                method: "POST",
                body: {
                    familyId: state.selectedFamilyId,
                    ...payload
                }
            });
        }

        resetTransactionForm();
        await refreshFamilyScopedData();
        setFlash(recordId ? "交易流水已更新。" : "交易流水已新增。", "success");
    }).catch(handleAsyncError);
}

async function onTransactionTableClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
        return;
    }

    const action = button.dataset.action;
    const recordId = parseStoredNumber(button.dataset.id);
    const record = state.transactions.find((item) => item.id === recordId);
    if (!record) {
        return;
    }

    if (action === "edit-transaction") {
        fillTransactionForm(record);
        return;
    }

    if (action === "delete-transaction") {
        const confirmed = window.confirm(`确认删除交易流水 #${record.id} 吗？`);
        if (!confirmed) {
            return;
        }

        await withLoading("正在删除交易流水...", async () => {
            await api(`/api/transaction-records/${record.id}`, { method: "DELETE" });
            resetTransactionForm();
            await refreshFamilyScopedData();
            setFlash("交易流水已删除。", "success");
        }).catch(handleAsyncError);
    }
}

async function onDebtSubmit(event) {
    event.preventDefault();
    if (!state.selectedFamilyId) {
        setFlash("请先选择家庭。", "warning");
        return;
    }

    const debtId = parseStoredNumber(refs.debtIdInput.value);
    const payload = {
        debtorMemberId: normalizeNullableNumber(refs.debtDebtorSelect.value),
        debtName: normalizeRequiredText(refs.debtNameInput.value, "请输入债务名称"),
        debtType: refs.debtTypeSelect.value,
        lenderName: normalizeText(refs.debtLenderInput.value),
        principalAmount: parseRequiredDecimal(refs.debtPrincipalInput.value, "请输入债务本金"),
        annualRate: normalizeNullableDecimal(refs.debtRateInput.value),
        billingDay: normalizeNullableInteger(refs.debtBillingDayInput.value),
        repaymentDay: normalizeNullableInteger(refs.debtRepaymentDayInput.value),
        dueDate: normalizeNullableDate(refs.debtDueDateInput.value),
        remark: normalizeText(refs.debtRemarkInput.value)
    };

    await withLoading(debtId ? "正在更新债务..." : "正在新增债务...", async () => {
        if (debtId) {
            await api(`/api/debts/${debtId}`, {
                method: "PUT",
                body: payload
            });
        } else {
            await api("/api/debts", {
                method: "POST",
                body: {
                    familyId: state.selectedFamilyId,
                    ...payload
                }
            });
        }

        resetDebtForm();
        await refreshFamilyScopedData();
        setFlash(debtId ? "债务信息已更新。" : "债务已新增。", "success");
    }).catch(handleAsyncError);
}

async function onDebtCardClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
        return;
    }

    const action = button.dataset.action;
    const debtId = parseStoredNumber(button.dataset.id);
    const debt = state.debts.find((item) => item.id === debtId);
    if (!debt) {
        return;
    }

    if (action === "edit-debt") {
        fillDebtForm(debt);
        return;
    }

    if (action === "select-repayment") {
        state.selectedRepaymentDebtId = debt.id;
        refs.repaymentDebtSelect.value = String(debt.id);
        await withLoading("正在加载该债务的还款记录...", refreshRepaymentsIfNeeded).catch(handleAsyncError);
        renderRepaymentHistory();
        return;
    }

    if (action === "clear-debt") {
        const confirmed = window.confirm(`确认将债务「${debt.debtName}」直接结清吗？`);
        if (!confirmed) {
            return;
        }
        await withLoading("正在结清债务...", async () => {
            await api(`/api/debts/${debt.id}/clear`, { method: "POST" });
            await refreshFamilyScopedData();
            setFlash("债务已结清。", "success");
        }).catch(handleAsyncError);
        return;
    }

    if (action === "delete-debt") {
        const confirmed = window.confirm(`确认删除债务「${debt.debtName}」吗？这会回滚关联还款。`);
        if (!confirmed) {
            return;
        }
        await withLoading("正在删除债务及关联还款...", async () => {
            await api(`/api/debts/${debt.id}`, { method: "DELETE" });
            resetDebtForm();
            await refreshFamilyScopedData();
            setFlash("债务已删除。", "success");
        }).catch(handleAsyncError);
    }
}

async function onRepaymentDebtChange(event) {
    state.selectedRepaymentDebtId = parseStoredNumber(event.target.value);
    await withLoading("正在加载还款记录...", refreshRepaymentsIfNeeded).catch(handleAsyncError);
    renderRepaymentHistory();
}

async function onRepaymentSubmit(event) {
    event.preventDefault();

    const debtId = parseRequiredNumber(refs.repaymentDebtSelect.value, "请选择还款债务");
    const payload = {
        familyId: state.selectedFamilyId,
        payAccountId: normalizeNullableNumber(refs.repaymentAccountSelect.value),
        createdByMemberId: normalizeNullableNumber(refs.repaymentCreatorSelect.value),
        amount: parseRequiredDecimal(refs.repaymentAmountInput.value, "请输入还款金额"),
        principalPaid: normalizeNullableDecimal(refs.repaymentPrincipalInput.value),
        interestPaid: normalizeNullableDecimal(refs.repaymentInterestInput.value),
        repaymentTime: parseRequiredDateTime(refs.repaymentTimeInput.value, "请选择还款时间"),
        note: normalizeText(refs.repaymentNoteInput.value)
    };

    await withLoading("正在记录还款...", async () => {
        await api(`/api/debts/${debtId}/repayments`, {
            method: "POST",
            body: payload
        });

        refs.repaymentAmountInput.value = "";
        refs.repaymentPrincipalInput.value = "";
        refs.repaymentInterestInput.value = "";
        refs.repaymentNoteInput.value = "";
        refs.repaymentTimeInput.value = currentDateTimeLocal();
        state.selectedRepaymentDebtId = debtId;
        await refreshFamilyScopedData();
        setFlash("还款记录已新增。", "success");
    }).catch(handleAsyncError);
}

function onRuleTypeChange() {
    toggleRuleFormFields();
}

function onRuleMetricTypeChange() {
    populateRuleSelects();
    toggleRuleFormFields();
}

async function onRuleSubmit(event) {
    event.preventDefault();
    if (!state.selectedFamilyId) {
        setFlash("请先选择家庭。", "warning");
        return;
    }

    const ruleType = refs.ruleTypeSelect.value;
    const metricType = refs.ruleMetricTypeSelect.value;
    const categoryId = metricType === "CATEGORY_EXPENSE"
            ? parseRequiredNumber(refs.ruleCategorySelect.value, "请选择规则分类")
            : null;

    const payload = {
        familyId: state.selectedFamilyId,
        categoryId,
        createdByMemberId: normalizeNullableNumber(refs.ruleCreatorSelect.value),
        ruleName: normalizeRequiredText(refs.ruleNameInput.value, "请输入规则名称"),
        ruleType,
        metricType,
        timeScope: resolveRuleTimeScope(ruleType),
        operatorType: resolveRuleOperator(ruleType),
        thresholdValue: parseRequiredDecimal(refs.ruleThresholdInput.value, "请输入规则阈值"),
        thresholdJson: buildRuleThresholdJson(ruleType, refs.ruleWindowInput.value),
        actionType: "NOTIFY",
        messageTemplate: normalizeRequiredText(refs.ruleMessageTemplateInput.value, "请输入消息模板"),
        priority: normalizeNullableInteger(refs.rulePriorityInput.value) || 100
    };

    await withLoading("正在创建规则...", async () => {
        await api("/api/rules", {
            method: "POST",
            body: payload
        });
        resetRuleForm();
        await refreshFamilyScopedData();
        setFlash("规则已创建。", "success");
    }).catch(handleAsyncError);
}

async function onEvaluateRules() {
    if (!state.selectedFamilyId) {
        setFlash("请先选择家庭。", "warning");
        return;
    }

    await withLoading("正在执行规则评估...", async () => {
        state.lastRuleEvaluation = await api(`/api/rules/evaluate?familyId=${state.selectedFamilyId}&month=${state.month}`, {
            method: "POST"
        });
        await refreshNotifications(false);
        renderRulesPanel();
        renderNotifications();
        setFlash("规则评估已完成。", "success");
    }).catch(handleAsyncError);
}

async function onImportSample(samplePath, label) {
    await withLoading(`正在导入${label}...`, async () => {
        const file = await fetchDemoSampleFile(samplePath);
        await runBillImport(file, label);
    }).catch(handleAsyncError);
}

async function onUploadBillFile() {
    const file = refs.billFileInput.files?.[0];
    if (!file) {
        setFlash("请选择要上传的 CSV 账单文件。", "warning");
        return;
    }

    await withLoading("正在上传本地账单...", async () => {
        await runBillImport(file, "本地账单");
    }).catch(handleAsyncError);
}

async function onRefreshBillImport() {
    await withLoading("正在刷新账单导入面板...", async () => {
        await refreshBillImportWorkspace();
        setFlash("账单导入面板已刷新。", "success");
    }).catch(handleAsyncError);
}

async function onBillParseRuleSubmit(event) {
    event.preventDefault();
    if (!state.selectedFamilyId) {
        setFlash("请先选择家庭。", "warning");
        return;
    }

    const payload = {
        familyId: state.selectedFamilyId,
        categoryId: parseRequiredNumber(refs.billParseCategorySelect.value, "请选择解析分类"),
        merchantKeyword: normalizeRequiredText(refs.billParseKeywordInput.value, "请输入商户关键词"),
        priority: normalizeNullableInteger(refs.billParsePriorityInput.value) || 10
    };

    await withLoading("正在创建解析规则...", async () => {
        await api("/api/bill-parse-rules", {
            method: "POST",
            body: payload
        });
        refs.billParseKeywordInput.value = "";
        refs.billParsePriorityInput.value = "10";
        await refreshBillImportWorkspace();
        setFlash("解析规则已创建。", "success");
    }).catch(handleAsyncError);
}

async function onBillPendingListClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button || button.dataset.action !== "resolve-pending") {
        return;
    }

    const pendingId = parseStoredNumber(button.dataset.id);
    const card = button.closest(".pending-card");
    if (!pendingId || !card) {
        return;
    }

    const categorySelect = card.querySelector(".pending-category-select");
    const createRuleCheckbox = card.querySelector(".pending-create-rule");
    const categoryId = parseRequiredNumber(categorySelect?.value, "请选择归类分类");

    await withLoading("正在处理待归类账单...", async () => {
        await api(`/api/bill-imports/pending-items/${pendingId}/resolve`, {
            method: "POST",
            body: {
                categoryId,
                resolvedByMemberId: normalizeNullableNumber(refs.billImportUploaderSelect.value),
                createParseRule: Boolean(createRuleCheckbox?.checked),
                priority: 20
            }
        });
        await refreshFamilyScopedData();
        setFlash("待归类账单已处理。", "success");
    }).catch(handleAsyncError);
}

async function onRefreshNotifications() {
    await withLoading("正在刷新通知列表...", async () => {
        await refreshNotifications(false);
        renderNotifications();
        setFlash("通知列表已刷新。", "success");
    }).catch(handleAsyncError);
}

async function onNotificationListClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
        return;
    }

    const action = button.dataset.action;
    if (action !== "read-notification") {
        return;
    }

    const notificationId = parseStoredNumber(button.dataset.id);
    if (!notificationId) {
        return;
    }

    await withLoading("正在标记通知为已读...", async () => {
        await api(`/api/notifications/${notificationId}/read`, { method: "POST" });
        await refreshNotifications(false);
        renderNotifications();
        setFlash("通知已标记为已读。", "success");
    }).catch(handleAsyncError);
}

async function refreshBillImportWorkspace(shouldRender = true) {
    if (!state.selectedFamilyId) {
        state.billImportBatches = [];
        state.billParseRules = [];
        state.pendingItems = [];
        state.billImportBatchError = null;
        state.billParseRuleError = null;
        state.billPendingError = null;
        if (shouldRender) {
            renderBillImportWorkspace();
        }
        return;
    }

    const familyId = state.selectedFamilyId;
    const [batchResult, ruleResult, pendingResult] = await Promise.allSettled([
        api(`/api/bill-imports?familyId=${familyId}`),
        api(`/api/bill-parse-rules?familyId=${familyId}`),
        api(`/api/bill-imports/pending-items?familyId=${familyId}&status=PENDING`)
    ]);

    state.billImportBatches = batchResult.status === "fulfilled" ? batchResult.value || [] : [];
    state.billParseRules = ruleResult.status === "fulfilled" ? ruleResult.value || [] : [];
    state.pendingItems = pendingResult.status === "fulfilled" ? pendingResult.value || [] : [];
    state.billImportBatchError = batchResult.status === "rejected" ? batchResult.reason?.message || "账单导入批次读取失败。" : null;
    state.billParseRuleError = ruleResult.status === "rejected" ? ruleResult.reason?.message || "解析规则读取失败。" : null;
    state.billPendingError = pendingResult.status === "rejected" ? pendingResult.reason?.message || "待归类列表读取失败。" : null;

    if (shouldRender) {
        renderBillImportWorkspace();
    }
}

async function refreshNotifications(shouldRender = true) {
    if (!state.selectedFamilyId) {
        state.notifications = [];
        if (shouldRender) {
            renderNotifications();
        }
        return;
    }
    state.notifications = await api(`/api/notifications?familyId=${state.selectedFamilyId}`);
    if (shouldRender) {
        renderNotifications();
    }
}

function onLogout() {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.familyId);
    localStorage.removeItem(STORAGE_KEYS.memberId);
    state.token = null;
    state.user = null;
    state.memberships = [];
    state.families = [];
    state.members = [];
    state.accounts = [];
    state.categories = [];
    state.dashboard = null;
    state.transactions = [];
    state.debts = [];
    state.repayments = [];
    state.rules = [];
    state.billImportBatches = [];
    state.billParseRules = [];
    state.pendingItems = [];
    state.notifications = [];
    state.lastRuleEvaluation = null;
    state.lastBillImportResult = null;
    state.billImportBatchError = null;
    state.billParseRuleError = null;
    state.billPendingError = null;
    state.selectedFamilyId = null;
    state.selectedMemberId = null;
    state.selectedRepaymentDebtId = null;
    refs.usernameInput.focus();
    renderAll();
    setFlash("已退出登录。", "info");
}

function renderAll() {
    renderAuthState();
    renderFamilySelect();
    renderMemberSelect();
    renderSessionSummary();
    renderDashboard();
    populateMemberSelects();
    populateAccountSelects();
    populateCategorySelect(refs.transactionCategorySelect, refs.transactionTypeSelect.value, refs.transactionCategorySelect.value);
    populateRepaymentDebtSelect();
    populateRuleSelects();
    populateBillImportSelects();
    renderTransactionsTable();
    renderDebtCards();
    renderRepaymentHistory();
    renderBillImportWorkspace();
    renderRulesPanel();
    renderNotifications();
    toggleTransactionTargetField();
    toggleRuleFormFields();
}

function renderAuthState() {
    const loggedIn = Boolean(state.token && state.user);
    const family = state.families.find((item) => item.id === state.selectedFamilyId);
    const disabled = !loggedIn || state.loading;

    refs.systemStatus.textContent = loggedIn
            ? `已登录：${safeText(state.user.nickname || state.user.realName || state.user.username)}，当前家庭 ${safeText(family?.familyName || "未选择")}`
            : "当前未登录，左侧登录后自动载入家庭数据。";

    refs.refreshButton.disabled = disabled;
    refs.logoutButton.disabled = !loggedIn || state.loading;

    for (const element of refs.workspaceControls.querySelectorAll("input, select, textarea, button")) {
        element.disabled = disabled;
    }

    refs.transactionForm.querySelectorAll("input, select, textarea, button").forEach((element) => {
        element.disabled = disabled;
    });
    refs.debtForm.querySelectorAll("input, select, textarea, button").forEach((element) => {
        element.disabled = disabled;
    });
    refs.repaymentForm.querySelectorAll("input, select, textarea, button").forEach((element) => {
        element.disabled = disabled;
    });
    refs.ruleForm.querySelectorAll("input, select, textarea, button").forEach((element) => {
        element.disabled = disabled;
    });
    refs.billParseRuleForm.querySelectorAll("input, select, textarea, button").forEach((element) => {
        element.disabled = disabled;
    });
    [
        refs.billImportAccountSelect,
        refs.billImportUploaderSelect,
        refs.importSampleOneButton,
        refs.importSampleTwoButton,
        refs.billFileInput,
        refs.uploadBillFileButton,
        refs.refreshBillImportButton
    ].forEach((element) => {
        element.disabled = disabled;
    });
    refs.evaluateRulesButton.disabled = disabled;
    refs.refreshNotificationsButton.disabled = disabled;

    refs.loginButton.disabled = state.loading;
}

function renderFamilySelect() {
    const options = state.families.map((family) => ({
        value: family.id,
        label: family.familyName
    }));
    setSelectOptions(refs.familySelect, options, {
        placeholder: state.families.length ? null : "暂无家庭",
        value: state.selectedFamilyId
    });
}

function renderMemberSelect() {
    const options = state.members.map((member) => ({
        value: member.memberId,
        label: member.memberName || member.nickname || member.username || `成员 #${member.memberId}`
    }));
    setSelectOptions(refs.memberSelect, options, {
        placeholder: state.members.length ? null : "暂无成员",
        value: state.selectedMemberId
    });
}

function renderSessionSummary() {
    if (!state.user) {
        refs.sessionSummary.textContent = "未建立会话";
        return;
    }

    const family = state.families.find((item) => item.id === state.selectedFamilyId);
    const member = state.members.find((item) => item.memberId === state.selectedMemberId);
    const userName = state.user.nickname || state.user.realName || state.user.username;
    refs.sessionSummary.innerHTML = [
        `<strong>${escapeHtml(userName)}</strong>`,
        `账号：${escapeHtml(state.user.username)}`,
        `家庭：${escapeHtml(family?.familyName || "未选择")}`,
        `默认成员：${escapeHtml(member?.memberName || member?.nickname || member?.username || "未选择")}`
    ].join("<br>");
}

function renderDashboard() {
    if (!state.dashboard) {
        refs.overviewCards.innerHTML = emptyState("登录后显示收支总览。");
        refs.assetCards.innerHTML = emptyState("登录后显示资产快照。");
        refs.indicatorList.innerHTML = emptyState("暂无关键指标。");
        refs.expenseStructureList.innerHTML = emptyState("暂无支出结构数据。");
        refs.trendList.innerHTML = emptyState("暂无趋势数据。");
        refs.budgetList.innerHTML = emptyState("暂无预算执行数据。");
        return;
    }

    const currency = currentCurrency();
    const overview = state.dashboard.overview || {};
    const assetSnapshot = state.dashboard.assetSnapshot || {};
    const keyIndicators = state.dashboard.keyIndicators || {};

    refs.overviewCards.innerHTML = renderMetricCards([
        {
            label: `月收入 (${state.dashboard.month})`,
            value: formatCurrency(overview.totalIncome, currency),
            hint: `收入笔数 ${overview.incomeTransactionCount ?? 0}`
        },
        {
            label: `月支出 (${state.dashboard.month})`,
            value: formatCurrency(overview.totalExpense, currency),
            hint: `支出笔数 ${overview.expenseTransactionCount ?? 0}`
        },
        {
            label: "净现金流",
            value: formatCurrency(overview.netCashFlow, currency),
            hint: `结余 ${formatCurrency(overview.savingsAmount, currency)}`
        },
        {
            label: "储蓄率",
            value: formatPercent(overview.savingsRate),
            hint: "收入减支出后的比例"
        }
    ]);

    refs.assetCards.innerHTML = renderMetricCards([
        {
            label: "账户余额",
            value: formatCurrency(assetSnapshot.totalAccountBalance, currency),
            hint: "账户实时余额汇总"
        },
        {
            label: "固定资产",
            value: formatCurrency(assetSnapshot.totalFixedAssetValue, currency),
            hint: "已登记固定资产价值"
        },
        {
            label: "债务余额",
            value: formatCurrency(assetSnapshot.totalDebtBalance, currency),
            hint: "未结清债务总额"
        },
        {
            label: "净资产",
            value: formatCurrency(assetSnapshot.netAssetValue, currency),
            hint: `总资产 ${formatCurrency(assetSnapshot.totalAssetValue, currency)}`
        }
    ]);

    refs.indicatorList.innerHTML = [
        indicatorItem("恩格尔系数", formatPercent(keyIndicators.engelCoefficient), "食品支出占总支出比例"),
        indicatorItem("负债资产比", formatPercent(keyIndicators.debtToAssetRatio), "债务余额占总资产比例"),
        indicatorItem("流动性覆盖月数", formatDecimal(keyIndicators.liquidityCoverageMonths), "账户余额可覆盖月支出时长"),
        indicatorItem(
            "最高支出分类",
            escapeHtml(keyIndicators.topExpenseCategory || "暂无"),
            `金额 ${formatCurrency(keyIndicators.topExpenseAmount, currency)}，占比 ${formatPercent(keyIndicators.topExpenseRatio)}`
        ),
        indicatorItem("活跃预算数", String(keyIndicators.activeBudgetCount ?? 0), `预警 ${keyIndicators.alertBudgetCount ?? 0}，超支 ${keyIndicators.exceededBudgetCount ?? 0}`)
    ].join("");

    const expenseItems = (state.dashboard.expenseStructure || []).map((item) => {
        return stackBarItem(
            item.categoryName || "未分类",
            `${formatCurrency(item.amount, currency)} / ${formatPercent(item.ratio)}`,
            item.ratio
        );
    });
    refs.expenseStructureList.innerHTML = expenseItems.length ? expenseItems.join("") : emptyState("当前月份暂无支出分类数据。");

    const trendItems = state.dashboard.monthlyTrend || [];
    const maxTrendValue = Math.max(1, ...trendItems.flatMap((item) => [
        Math.abs(Number(item.income || 0)),
        Math.abs(Number(item.expense || 0)),
        Math.abs(Number(item.netAmount || 0))
    ]));
    refs.trendList.innerHTML = trendItems.length
            ? trendItems.map((item) => renderTrendItem(item, currency, maxTrendValue)).join("")
            : emptyState("暂无趋势数据。");

    const budgetItems = (state.dashboard.budgetProgress || []).map((item) => {
        const statusPill = item.exceeded
                ? `<span class="pill error">超支</span>`
                : item.alertTriggered
                        ? `<span class="pill warning">预警</span>`
                        : `<span class="pill success">正常</span>`;
        return `
            <div class="stack-item">
                <strong>${escapeHtml(item.budgetName || "未命名预算")}</strong>
                <span>${escapeHtml(item.categoryName || "未分类")} · ${escapeHtml(item.month || "-")}</span>
                <span>已用 ${formatCurrency(item.spentAmount, currency)} / 预算 ${formatCurrency(item.budgetAmount, currency)}</span>
                <div class="bar-row"><div class="bar-fill" style="width:${barWidth(item.usageRatio)}%"></div></div>
                <span>剩余 ${formatCurrency(item.remainingAmount, currency)} · 使用率 ${formatPercent(item.usageRatio)}</span>
                ${statusPill}
            </div>
        `;
    });
    refs.budgetList.innerHTML = budgetItems.length ? budgetItems.join("") : emptyState("暂无预算执行数据。");
}

function renderTransactionsTable() {
    if (!state.transactions.length) {
        refs.transactionTableBody.innerHTML = `<tr><td colspan="7">${emptyState("当前家庭暂无交易流水。")}</td></tr>`;
        return;
    }

    refs.transactionTableBody.innerHTML = state.transactions.map((record) => {
        const accountName = findAccountName(record.accountId);
        const targetAccountName = findAccountName(record.targetAccountId);
        const categoryName = findCategoryName(record.categoryId);
        const amountText = formatCurrency(record.amount, currentCurrency());
        const typeText = translateTransactionType(record.transactionType);
        const note = [record.merchantName, record.note].filter(Boolean).join(" / ");
        return `
            <tr>
                <td>${escapeHtml(formatDateTime(record.transactionTime))}</td>
                <td>${escapeHtml(typeText)}</td>
                <td>${escapeHtml(amountText)}</td>
                <td>${escapeHtml(accountName)}${targetAccountName ? `<br><span class="muted">-> ${escapeHtml(targetAccountName)}</span>` : ""}</td>
                <td>${escapeHtml(categoryName)}</td>
                <td>${escapeHtml(note || "-")}</td>
                <td>
                    <div class="row-actions">
                        <button type="button" class="row-button" data-action="edit-transaction" data-id="${record.id}">编辑</button>
                        <button type="button" class="row-button danger" data-action="delete-transaction" data-id="${record.id}">删除</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function renderDebtCards() {
    if (!state.debts.length) {
        refs.debtCardList.innerHTML = emptyState("当前家庭暂无债务记录。");
        return;
    }

    refs.debtCardList.innerHTML = state.debts.map((debt) => {
        const memberName = findMemberName(debt.debtorMemberId);
        const statusPill = debt.status === "CLEARED"
                ? `<span class="pill success">已结清</span>`
                : debt.nextReminderDate
                        ? `<span class="pill warning">下次提醒 ${escapeHtml(String(debt.nextReminderDate))}</span>`
                        : `<span class="pill success">进行中</span>`;
        return `
            <div class="debt-card">
                <div class="panel-head compact">
                    <div>
                        <strong>${escapeHtml(debt.debtName)}</strong>
                        <span>${escapeHtml(translateDebtType(debt.debtType))} · ${escapeHtml(memberName)}</span>
                    </div>
                    ${statusPill}
                </div>
                <div class="debt-meta">
                    <div>本金：${escapeHtml(formatCurrency(debt.principalAmount, currentCurrency()))}</div>
                    <div>余额：${escapeHtml(formatCurrency(debt.currentBalance, currentCurrency()))}</div>
                    <div>债权方：${escapeHtml(debt.lenderName || "-")}</div>
                    <div>年利率：${escapeHtml(formatDecimal(debt.annualRate))}%</div>
                    <div>账单日：${escapeHtml(safeText(debt.billingDay))}</div>
                    <div>还款日：${escapeHtml(safeText(debt.repaymentDay))}</div>
                    <div>到期日：${escapeHtml(safeText(debt.dueDate))}</div>
                    <div>备注：${escapeHtml(debt.remark || "-")}</div>
                </div>
                <div class="debt-actions">
                    <button type="button" class="row-button" data-action="edit-debt" data-id="${debt.id}">编辑</button>
                    <button type="button" class="row-button" data-action="select-repayment" data-id="${debt.id}">选中还款</button>
                    <button type="button" class="row-button" data-action="clear-debt" data-id="${debt.id}">结清</button>
                    <button type="button" class="row-button danger" data-action="delete-debt" data-id="${debt.id}">删除</button>
                </div>
            </div>
        `;
    }).join("");
}

function renderRepaymentHistory() {
    if (!state.selectedRepaymentDebtId) {
        refs.repaymentHistory.innerHTML = emptyState("选中债务后显示还款记录。");
        return;
    }
    if (!state.repayments.length) {
        refs.repaymentHistory.innerHTML = emptyState("该债务暂无还款记录。");
        return;
    }

    refs.repaymentHistory.innerHTML = state.repayments.map((repayment) => {
        return `
            <div class="stack-item">
                <strong>${escapeHtml(formatDateTime(repayment.repaymentTime))}</strong>
                <span>金额 ${formatCurrency(repayment.amount, currentCurrency())} · 本金 ${formatCurrency(repayment.principalPaid, currentCurrency())} · 利息 ${formatCurrency(repayment.interestPaid, currentCurrency())}</span>
                <span>账户 ${escapeHtml(findAccountName(repayment.payAccountId))} · 成员 ${escapeHtml(findMemberName(repayment.createdByMemberId))}</span>
                <span>${escapeHtml(repayment.note || "无备注")}</span>
            </div>
        `;
    }).join("");
}

function renderBillImportWorkspace() {
    renderBillImportSummary();
    renderBillImportBatches();
    renderBillPendingItems();
    renderBillParseRules();
}

function renderBillImportSummary() {
    if (!state.lastBillImportResult) {
        refs.billImportSummary.innerHTML = emptyState("建议先导入样例一，观察自动归类与待归类队列。");
        return;
    }

    const result = state.lastBillImportResult;
    const warnings = (result.warnings || []).length
            ? `<div class="inline-pills">${(result.warnings || []).map((item) => `<span class="pill warning">${escapeHtml(item)}</span>`).join("")}</div>`
            : "";

    refs.billImportSummary.innerHTML = `
        <div class="summary-card">
            <strong>最近一次导入结果</strong>
            <p>批次 #${escapeHtml(safeText(result.batch?.id))} 路 成功 ${escapeHtml(safeText(result.importedCount))} 笔 路 失败 ${escapeHtml(safeText(result.failedCount))} 笔 路 待归类 ${escapeHtml(safeText(result.unmatchedCount))} 笔</p>
            ${warnings}
        </div>
    `;
}

function renderBillImportBatches() {
    if (state.billImportBatchError) {
        refs.billImportBatchList.innerHTML = renderPermissionNote(state.billImportBatchError);
        return;
    }

    if (!state.billImportBatches.length) {
        refs.billImportBatchList.innerHTML = emptyState("当前家庭还没有导入批次。");
        return;
    }

    const batches = state.billImportBatches.slice().sort((left, right) => {
        const leftTime = left.importedAt || "";
        const rightTime = right.importedAt || "";
        return rightTime.localeCompare(leftTime);
    });

    refs.billImportBatchList.innerHTML = batches.map((batch) => `
        <div class="stack-item">
            <strong>${escapeHtml(batch.originalFileName || "Unnamed Batch")}</strong>
            <div class="detail-grid">
                <div>批次 ID：${escapeHtml(safeText(batch.id))}</div>
                <div>平台：${escapeHtml(batch.sourcePlatform || "CSV")}</div>
                <div>总数：${escapeHtml(safeText(batch.totalCount))}</div>
                <div>成功：${escapeHtml(safeText(batch.successCount))}</div>
                <div>失败：${escapeHtml(safeText(batch.failCount))}</div>
                <div>待归类：${escapeHtml(safeText(batch.unmatchedCount))}</div>
            </div>
            <span>导入时间 ${escapeHtml(formatDateTime(batch.importedAt))}</span>
        </div>
    `).join("");
}

function renderBillPendingItems() {
    if (state.billPendingError) {
        refs.billPendingList.innerHTML = renderPermissionNote(state.billPendingError);
        return;
    }

    if (!state.pendingItems.length) {
        refs.billPendingList.innerHTML = emptyState("当前没有待归类账单。");
        return;
    }

    const categoryOptions = buildExpenseCategoryOptions();
    refs.billPendingList.innerHTML = state.pendingItems.map((item) => `
        <div class="stack-item pending-card" data-pending-id="${item.id}">
            <strong>${escapeHtml(item.merchantName || "UNKNOWN")}</strong>
            <div class="detail-grid">
                <div>金额：${escapeHtml(formatCurrency(item.amount, currentCurrency()))}</div>
                <div>时间：${escapeHtml(formatDateTime(item.transactionTime))}</div>
                <div>平台：${escapeHtml(item.sourcePlatform || "CSV")}</div>
                <div>批次：#${escapeHtml(safeText(item.sourceBatchId))}</div>
                <div>原始分类：${escapeHtml(item.rawCategoryName || "-")}</div>
                <div>备注：${escapeHtml(item.note || "-")}</div>
            </div>
            <label class="field">
                <span>归类分类</span>
                <select class="pending-category-select">
                    ${buildOptionsHtml(categoryOptions, item.resolvedCategoryId || categoryOptions[0]?.value, "请选择支出分类")}
                </select>
            </label>
            <label class="checkbox-line">
                <input type="checkbox" class="pending-create-rule" checked>
                <span>同时补充解析规则</span>
            </label>
            <div class="item-actions">
                <button type="button" class="row-button" data-action="resolve-pending" data-id="${item.id}">确认归类</button>
            </div>
        </div>
    `).join("");
}

function renderBillParseRules() {
    if (state.billParseRuleError) {
        refs.billParseRuleList.innerHTML = renderPermissionNote(state.billParseRuleError);
        return;
    }

    if (!state.billParseRules.length) {
        refs.billParseRuleList.innerHTML = emptyState("当前没有解析规则。");
        return;
    }

    refs.billParseRuleList.innerHTML = state.billParseRules.map((rule) => `
        <div class="stack-item">
            <strong>${escapeHtml(rule.merchantKeyword || rule.regexPattern || "Unnamed Rule")}</strong>
            <span>分类 ${escapeHtml(rule.categoryName || findCategoryName(rule.categoryId))} 路 优先级 ${escapeHtml(safeText(rule.priority))}</span>
            <span>命中次数 ${escapeHtml(safeText(rule.hitCount))} 路 最近命中 ${escapeHtml(formatDateTime(rule.lastHitAt))}</span>
        </div>
    `).join("");
}

function renderRulesPanel() {
    refs.ruleEvaluateSummary.innerHTML = state.lastRuleEvaluation
            ? renderRuleEvaluationSummary(state.lastRuleEvaluation)
            : emptyState("点击“评估本月规则”后显示规则评估结果。");

    if (!state.rules.length) {
        refs.ruleList.innerHTML = emptyState("当前家庭暂无规则定义。");
        return;
    }

    refs.ruleList.innerHTML = state.rules.map((rule) => {
        const ruleCategoryText = rule.metricType === "FAMILY_EXPENSE"
                ? "Family Total"
                : findCategoryName(rule.categoryId);
        return `
            <div class="stack-item">
                <strong>${escapeHtml(rule.ruleName || "Unnamed Rule")}</strong>
                <span>${escapeHtml(translateRuleType(rule.ruleType))} · ${escapeHtml(translateMetricType(rule.metricType))} · ${escapeHtml(rule.timeScope || "-")}</span>
                <span>Operator ${escapeHtml(rule.operatorType || "-")} · Threshold ${escapeHtml(formatDecimal(rule.thresholdValue))} · Priority ${escapeHtml(safeText(rule.priority))}</span>
                <span>Category ${escapeHtml(ruleCategoryText)} · Creator ${escapeHtml(findMemberName(rule.createdByMemberId))}</span>
                <span>Extra Config ${escapeHtml(describeRuleThresholdJson(rule.thresholdJson))}</span>
                <span>Message ${escapeHtml(rule.messageTemplate || "-")}</span>
                <div class="inline-pills">
                    <span class="pill ${rule.enabled === 1 ? "success" : "warning"}">${rule.enabled === 1 ? "Enabled" : "Disabled"}</span>
                    <span class="pill warning">${escapeHtml(rule.actionType || "NOTIFY")}</span>
                </div>
            </div>
        `;
    }).join("");
}

function renderNotifications() {
    if (!state.notifications.length) {
        refs.notificationList.innerHTML = emptyState("当前暂无通知。");
        return;
    }

    refs.notificationList.innerHTML = state.notifications.map((notification) => {
        const unreadClass = notification.readStatus === 1 ? "" : " unread";
        const button = notification.readStatus === 1
                ? ""
                : `<button type="button" class="row-button" data-action="read-notification" data-id="${notification.id}">标记已读</button>`;
        return `
            <div class="stack-item notification-item${unreadClass}">
                <strong>${escapeHtml(notification.title || "Notification")}</strong>
                <span>${escapeHtml(notification.content || "-")}</span>
                <div class="inline-pills">
                    <span class="pill ${notification.readStatus === 1 ? "success" : "warning"}">${notification.readStatus === 1 ? "READ" : "UNREAD"}</span>
                    <span class="pill ${notification.levelCode === "WARN" ? "warning" : "success"}">${escapeHtml(notification.levelCode || "INFO")}</span>
                    <span class="pill warning">${escapeHtml(notification.sourceType || "-")}</span>
                </div>
                <p class="meta-text">
                    Source #${escapeHtml(safeText(notification.sourceId))} ·
                    Target ${escapeHtml(findMemberName(notification.targetMemberId))} ·
                    Created ${escapeHtml(formatDateTime(notification.createdAt))}
                </p>
                <div class="item-actions">${button}</div>
            </div>
        `;
    }).join("");
}

function renderRuleEvaluationSummary(result) {
    const details = (result.details || []).length
            ? (result.details || []).map((detail) => `<div class="stack-item">${escapeHtml(detail)}</div>`).join("")
            : '<div class="stack-item">No details generated in this evaluation.</div>';

    return `
        <div class="summary-card">
            <strong>Latest Evaluation ${escapeHtml(result.month || state.month)}</strong>
            <p>Budget Alerts ${escapeHtml(safeText(result.budgetAlertCount))} · Triggered Rules ${escapeHtml(safeText(result.triggeredRuleCount))} · Notifications ${escapeHtml(safeText(result.generatedNotificationCount))}</p>
            <div class="stack-list">${details}</div>
        </div>
    `;
}

function populateMemberSelects() {
    const options = state.members.map((member) => ({
        value: member.memberId,
        label: member.memberName || member.nickname || member.username || `成员 #${member.memberId}`
    }));
    const defaultMember = state.selectedMemberId;
    setSelectOptions(refs.transactionCreatorSelect, options, {
        placeholder: "不指定",
        value: refs.transactionRecordId.value ? refs.transactionCreatorSelect.value : defaultMember
    });
    setSelectOptions(refs.debtDebtorSelect, options, {
        placeholder: "不指定",
        value: refs.debtIdInput.value ? refs.debtDebtorSelect.value : defaultMember
    });
    setSelectOptions(refs.repaymentCreatorSelect, options, {
        placeholder: "不指定",
        value: defaultMember
    });
}

function populateRuleSelects() {
    const creatorOptions = state.members.map((member) => ({
        value: member.memberId,
        label: member.memberName || member.nickname || member.username || `成员 #${member.memberId}`
    }));
    setSelectOptions(refs.ruleCreatorSelect, creatorOptions, {
        placeholder: "不指定",
        value: refs.ruleCreatorSelect.value || state.selectedMemberId
    });

    const categoryOptions = state.categories
            .filter((category) => category.categoryType === "EXPENSE")
            .map((category) => ({
                value: category.id,
                label: `${category.categoryName}${category.enabled === 1 ? "" : " (停用)"}`
            }));
    setSelectOptions(refs.ruleCategorySelect, categoryOptions, {
        placeholder: "请选择支出分类",
        value: refs.ruleCategorySelect.value
    });
}

function populateBillImportSelects() {
    const memberOptions = state.members.map((member) => ({
        value: member.memberId,
        label: member.memberName || member.nickname || member.username || `成员 #${member.memberId}`
    }));
    setSelectOptions(refs.billImportUploaderSelect, memberOptions, {
        placeholder: "不指定成员",
        value: refs.billImportUploaderSelect.value || state.selectedMemberId
    });

    const accountOptions = state.accounts.map((account) => ({
        value: account.id,
        label: `${account.accountName}${account.status === 1 ? "" : " (停用)"}`
    }));
    setSelectOptions(refs.billImportAccountSelect, accountOptions, {
        placeholder: state.accounts.length ? "请选择导入账户" : "暂无账户",
        value: refs.billImportAccountSelect.value || state.accounts[0]?.id
    });

    const categoryOptions = buildExpenseCategoryOptions();
    setSelectOptions(refs.billParseCategorySelect, categoryOptions, {
        placeholder: "请选择支出分类",
        value: refs.billParseCategorySelect.value || categoryOptions[0]?.value
    });
}

function populateAccountSelects() {
    const options = state.accounts.map((account) => ({
        value: account.id,
        label: `${account.accountName}${account.status === 1 ? "" : " (停用)"}`
    }));

    setSelectOptions(refs.transactionAccountSelect, options, {
        placeholder: state.accounts.length ? "请选择账户" : "暂无账户",
        value: refs.transactionAccountSelect.value
    });
    setSelectOptions(refs.transactionTargetAccountSelect, options, {
        placeholder: "无需选择",
        value: refs.transactionTargetAccountSelect.value
    });
    setSelectOptions(refs.repaymentAccountSelect, options, {
        placeholder: "不指定账户",
        value: refs.repaymentAccountSelect.value
    });
}

function populateCategorySelect(select, transactionType, selectedValue) {
    const categories = transactionType === "TRANSFER"
            ? []
            : state.categories.filter((category) => category.categoryType === transactionType);

    const options = categories.map((category) => ({
        value: category.id,
        label: `${category.categoryName}${category.enabled === 1 ? "" : " (停用)"}`
    }));

    setSelectOptions(select, options, {
        placeholder: transactionType === "TRANSFER" ? "转账无需分类" : "不指定分类",
        value: selectedValue
    });
}

function populateRepaymentDebtSelect() {
    const options = state.debts.map((debt) => ({
        value: debt.id,
        label: `${debt.debtName} (${debt.status === "CLEARED" ? "已结清" : "余额 " + formatCurrency(debt.currentBalance, currentCurrency())})`
    }));
    setSelectOptions(refs.repaymentDebtSelect, options, {
        placeholder: state.debts.length ? "请选择债务" : "暂无债务",
        value: state.selectedRepaymentDebtId
    });
}

function toggleTransactionTargetField() {
    const isTransfer = refs.transactionTypeSelect.value === "TRANSFER";
    refs.transactionTargetField.classList.toggle("hidden", !isTransfer);
    refs.transactionTargetAccountSelect.required = isTransfer;
    refs.transactionCategorySelect.disabled = isTransfer || !state.token || state.loading;
}

function fillTransactionForm(record) {
    refs.transactionRecordId.value = record.id;
    refs.transactionTypeSelect.value = record.transactionType || "EXPENSE";
    setSelectOptions(refs.transactionAccountSelect, state.accounts.map((account) => ({
        value: account.id,
        label: `${account.accountName}${account.status === 1 ? "" : " (停用)"}`
    })), {
        placeholder: "请选择账户",
        value: record.accountId
    });
    setSelectOptions(refs.transactionTargetAccountSelect, state.accounts.map((account) => ({
        value: account.id,
        label: `${account.accountName}${account.status === 1 ? "" : " (停用)"}`
    })), {
        placeholder: "无需选择",
        value: record.targetAccountId
    });
    populateCategorySelect(refs.transactionCategorySelect, refs.transactionTypeSelect.value, record.categoryId);
    setSelectOptions(refs.transactionCreatorSelect, state.members.map((member) => ({
        value: member.memberId,
        label: member.memberName || member.nickname || member.username || `成员 #${member.memberId}`
    })), {
        placeholder: "不指定",
        value: record.createdByMemberId
    });
    refs.transactionAmountInput.value = record.amount ?? "";
    refs.transactionTimeInput.value = toDateTimeLocalValue(record.transactionTime) || currentDateTimeLocal();
    refs.transactionMerchantInput.value = record.merchantName || "";
    refs.transactionCounterpartyInput.value = record.counterpartyName || "";
    refs.transactionSourcePlatformInput.value = record.sourcePlatform || "";
    refs.transactionNoteInput.value = record.note || "";
    refs.transactionSubmitText.textContent = "更新流水";
    toggleTransactionTargetField();
}

function resetTransactionForm() {
    refs.transactionRecordId.value = "";
    refs.transactionTypeSelect.value = "EXPENSE";
    refs.transactionAmountInput.value = "";
    refs.transactionTimeInput.value = currentDateTimeLocal();
    refs.transactionMerchantInput.value = "";
    refs.transactionCounterpartyInput.value = "";
    refs.transactionSourcePlatformInput.value = "MANUAL";
    refs.transactionNoteInput.value = "";
    refs.transactionSubmitText.textContent = "新增流水";
    populateAccountSelects();
    populateCategorySelect(refs.transactionCategorySelect, refs.transactionTypeSelect.value, null);
    populateMemberSelects();
    toggleTransactionTargetField();
}

function fillDebtForm(debt) {
    refs.debtIdInput.value = debt.id;
    refs.debtNameInput.value = debt.debtName || "";
    refs.debtTypeSelect.value = debt.debtType || "LOAN";
    setSelectOptions(refs.debtDebtorSelect, state.members.map((member) => ({
        value: member.memberId,
        label: member.memberName || member.nickname || member.username || `成员 #${member.memberId}`
    })), {
        placeholder: "不指定",
        value: debt.debtorMemberId
    });
    refs.debtLenderInput.value = debt.lenderName || "";
    refs.debtPrincipalInput.value = debt.principalAmount ?? "";
    refs.debtRateInput.value = debt.annualRate ?? "";
    refs.debtBillingDayInput.value = debt.billingDay ?? "";
    refs.debtRepaymentDayInput.value = debt.repaymentDay ?? "";
    refs.debtDueDateInput.value = debt.dueDate || "";
    refs.debtRemarkInput.value = debt.remark || "";
    refs.debtSubmitText.textContent = "更新债务";
}

function resetDebtForm() {
    refs.debtIdInput.value = "";
    refs.debtNameInput.value = "";
    refs.debtTypeSelect.value = "CREDIT_CARD";
    refs.debtLenderInput.value = "";
    refs.debtPrincipalInput.value = "";
    refs.debtRateInput.value = "";
    refs.debtBillingDayInput.value = "";
    refs.debtRepaymentDayInput.value = "";
    refs.debtDueDateInput.value = "";
    refs.debtRemarkInput.value = "";
    refs.debtSubmitText.textContent = "新增债务";
    populateMemberSelects();
}

function resetRuleForm() {
    refs.ruleNameInput.value = "";
    refs.ruleTypeSelect.value = "THRESHOLD";
    refs.ruleMetricTypeSelect.value = "CATEGORY_EXPENSE";
    refs.ruleTimeScopeSelect.value = "MONTH";
    refs.ruleOperatorSelect.value = "GT";
    refs.ruleThresholdInput.value = "";
    refs.ruleWindowInput.value = "";
    refs.rulePriorityInput.value = "100";
    refs.ruleMessageTemplateInput.value = "规则触发，请关注当前家庭财务波动";
    if (refs.ruleCreatorSelect) {
        refs.ruleCreatorSelect.value = "";
    }
    toggleRuleFormFields();
}

function toggleRuleFormFields() {
    const ruleType = refs.ruleTypeSelect.value;
    const metricType = refs.ruleMetricTypeSelect.value;
    const needsCategory = metricType === "CATEGORY_EXPENSE";
    const needsWindow = ruleType !== "THRESHOLD";

    refs.ruleCategoryField.classList.toggle("hidden", !needsCategory);
    refs.ruleCategorySelect.disabled = !needsCategory || !state.token || state.loading;
    refs.ruleCategorySelect.required = needsCategory;

    refs.ruleWindowField.classList.toggle("hidden", !needsWindow);
    refs.ruleWindowInput.disabled = !needsWindow || !state.token || state.loading;
    refs.ruleWindowInput.required = needsWindow;
    refs.ruleWindowLabel.textContent = ruleType === "TREND_ANOMALY" ? "Baseline Months" : "Consecutive Months";

    refs.ruleTimeScopeSelect.disabled = ruleType !== "THRESHOLD" || !state.token || state.loading;
    if (ruleType !== "THRESHOLD") {
        refs.ruleTimeScopeSelect.value = "MONTH";
    }

    if (ruleType === "TREND_ANOMALY" && !["GT", "GTE"].includes(refs.ruleOperatorSelect.value)) {
        refs.ruleOperatorSelect.value = "GTE";
    }
}

function buildRuleThresholdJson(ruleType, windowValue) {
    if (ruleType === "THRESHOLD") {
        return null;
    }
    const months = normalizeNullableInteger(windowValue);
    if (!months || months < 1) {
        throw new Error("请输入有效的规则窗口参数。");
    }
    if (ruleType === "TREND_ANOMALY") {
        return JSON.stringify({ baselineMonths: months });
    }
    return JSON.stringify({ consecutiveMonths: months });
}

function resolveRuleTimeScope(ruleType) {
    return ruleType === "THRESHOLD" ? refs.ruleTimeScopeSelect.value : "MONTH";
}

function resolveRuleOperator(ruleType) {
    const operator = refs.ruleOperatorSelect.value;
    if (ruleType === "TREND_ANOMALY" && !["GT", "GTE"].includes(operator)) {
        throw new Error("TREND_ANOMALY 规则仅支持 GT 或 GTE。");
    }
    return operator;
}

function buildExpenseCategoryOptions() {
    return state.categories
            .filter((category) => category.categoryType === "EXPENSE")
            .map((category) => ({
                value: category.id,
                label: `${category.categoryName}${category.enabled === 1 ? "" : " (停用)"}`
            }));
}

function buildOptionsHtml(options, selectedValue, placeholder = null) {
    let html = "";
    if (placeholder !== null) {
        html += `<option value="">${escapeHtml(placeholder)}</option>`;
    }

    for (const option of options) {
        const selected = String(option.value) === String(selectedValue) ? " selected" : "";
        html += `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.label)}</option>`;
    }
    return html;
}

function renderPermissionNote(message) {
    return `<div class="permission-note">${escapeHtml(message)}</div>`;
}

async function fetchDemoSampleFile(samplePath) {
    const response = await fetch(samplePath);
    if (!response.ok) {
        throw new Error(`样例账单读取失败: ${response.status}`);
    }
    const blob = await response.blob();
    const fileName = samplePath.split("/").pop() || "demo-sample.csv";
    return new File([blob], fileName, { type: blob.type || "text/csv" });
}

function buildBillImportFormData(file) {
    if (!state.selectedFamilyId) {
        throw new Error("请先选择家庭。");
    }

    const accountId = parseRequiredNumber(refs.billImportAccountSelect.value, "请选择导入账户");
    const uploadedByMemberId = normalizeNullableNumber(refs.billImportUploaderSelect.value);
    const formData = new FormData();
    formData.append("familyId", String(state.selectedFamilyId));
    if (uploadedByMemberId) {
        formData.append("uploadedByMemberId", String(uploadedByMemberId));
    }
    formData.append("accountId", String(accountId));
    formData.append("sourcePlatform", "CSV");
    formData.append("file", file, file.name || "demo-import.csv");
    return formData;
}

async function runBillImport(file, label) {
    const result = await api("/api/bill-imports/upload", {
        method: "POST",
        formData: buildBillImportFormData(file)
    });
    state.lastBillImportResult = result;
    refs.billFileInput.value = "";
    await refreshFamilyScopedData();
    setFlash(`${label}导入完成，成功 ${result.importedCount} 笔，待归类 ${result.unmatchedCount} 笔。`, "success");
}

async function withLoading(message, task) {
    state.loading = true;
    renderAuthState();
    setFlash(message, "info");
    try {
        return await task();
    } finally {
        state.loading = false;
        renderAuthState();
    }
}

async function api(path, options = {}) {
    const headers = {
        ...(options.headers || {})
    };
    if (options.auth !== false && state.token) {
        headers.Authorization = `Bearer ${state.token}`;
    }

    let body;
    if (options.formData) {
        body = options.formData;
    } else if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(options.body);
    }

    const response = await fetch(path, {
        method: options.method || "GET",
        headers,
        body
    });

    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
            ? await response.json()
            : await response.text();

    if (!response.ok) {
        if (response.status === 401 && path !== "/api/auth/login") {
            onLogout();
            throw new Error("登录状态已失效，请重新登录。");
        }
        throw new Error(extractErrorMessage(payload) || `请求失败：${response.status}`);
    }
    return payload;
}

function setFlash(message, type = "info") {
    refs.flashMessage.dataset.type = type;
    refs.flashMessage.textContent = message;
}

function handleAsyncError(error) {
    console.error(error);
    setFlash(error?.message || "发生未知错误。", "error");
}

function setSelectOptions(select, options, config = {}) {
    const { placeholder = null, value = null } = config;
    const previousValue = value ?? select.value;
    let html = "";
    if (placeholder !== null) {
        html += `<option value="">${escapeHtml(placeholder)}</option>`;
    }
    html += options.map((option) => {
        return `<option value="${escapeHtml(String(option.value))}">${escapeHtml(option.label)}</option>`;
    }).join("");
    select.innerHTML = html;

    if (previousValue !== null && previousValue !== undefined && previousValue !== "") {
        select.value = String(previousValue);
    }
    if (select.value === "" && !placeholder && options[0]) {
        select.value = String(options[0].value);
    }
}

function renderMetricCards(items) {
    return items.map((item) => `
        <article class="metric-card">
            <p class="metric-label">${escapeHtml(item.label)}</p>
            <p class="metric-value">${escapeHtml(item.value)}</p>
            <p class="metric-hint">${escapeHtml(item.hint || "")}</p>
        </article>
    `).join("");
}

function renderTrendItem(item, currency, maxValue) {
    return `
        <div class="trend-item">
            <strong>${escapeHtml(item.month || "-")}</strong>
            <div class="trend-bars">
                ${trendBarLine("收入", item.income, currency, maxValue)}
                ${trendBarLine("支出", item.expense, currency, maxValue)}
                ${trendBarLine("净流", item.netAmount, currency, maxValue)}
            </div>
        </div>
    `;
}

function trendBarLine(label, value, currency, maxValue) {
    const numericValue = Math.abs(Number(value || 0));
    const width = Math.max(4, Math.round((numericValue / maxValue) * 100));
    return `
        <div class="trend-bar-line">
            <span>${escapeHtml(label)}</span>
            <div class="bar-row"><div class="bar-fill" style="width:${width}%"></div></div>
            <strong>${escapeHtml(formatCurrency(value, currency))}</strong>
        </div>
    `;
}

function indicatorItem(label, value, hint) {
    return `
        <div class="indicator-item">
            <strong>${label}</strong>
            <span>${value}</span>
            <span>${hint}</span>
        </div>
    `;
}

function stackBarItem(title, summary, ratio) {
    return `
        <div class="stack-item">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(summary)}</span>
            <div class="bar-row"><div class="bar-fill" style="width:${barWidth(ratio)}%"></div></div>
        </div>
    `;
}

function emptyState(message) {
    return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function barWidth(ratio) {
    const numeric = Number(ratio || 0);
    return Math.min(100, Math.max(0, Math.round(numeric * 100)));
}

function currentCurrency() {
    const family = state.families.find((item) => item.id === state.selectedFamilyId);
    return family?.currencyCode || "CNY";
}

function findAccountName(accountId) {
    if (!accountId) {
        return "未指定";
    }
    return state.accounts.find((account) => account.id === accountId)?.accountName || `账户 #${accountId}`;
}

function findCategoryName(categoryId) {
    if (!categoryId) {
        return "未指定";
    }
    return state.categories.find((category) => category.id === categoryId)?.categoryName || `分类 #${categoryId}`;
}

function findMemberName(memberId) {
    if (!memberId) {
        return "未指定";
    }
    const member = state.members.find((item) => item.memberId === memberId);
    return member?.memberName || member?.nickname || member?.username || `成员 #${memberId}`;
}

function translateTransactionType(type) {
    switch (type) {
        case "INCOME":
            return "收入";
        case "EXPENSE":
            return "支出";
        case "TRANSFER":
            return "转账";
        default:
            return type || "-";
    }
}

function translateDebtType(type) {
    switch (type) {
        case "CREDIT_CARD":
            return "信用卡";
        case "LOAN":
            return "贷款";
        case "MORTGAGE":
            return "房贷";
        default:
            return type || "-";
    }
}

function translateRuleType(type) {
    switch (type) {
        case "THRESHOLD":
            return "Threshold";
        case "CONSECUTIVE_THRESHOLD":
            return "Consecutive Threshold";
        case "TREND_ANOMALY":
            return "Trend Anomaly";
        default:
            return type || "-";
    }
}

function translateMetricType(type) {
    switch (type) {
        case "CATEGORY_EXPENSE":
            return "Category Expense";
        case "FAMILY_EXPENSE":
            return "Family Expense";
        default:
            return type || "-";
    }
}

function describeRuleThresholdJson(thresholdJson) {
    if (!thresholdJson) {
        return "None";
    }
    try {
        const parsed = JSON.parse(thresholdJson);
        return Object.entries(parsed)
                .map(([key, value]) => `${key}=${value}`)
                .join(", ");
    } catch (error) {
        return thresholdJson;
    }
}

function formatCurrency(value, currencyCode = "CNY") {
    const number = Number(value || 0);
    try {
        return new Intl.NumberFormat("zh-CN", {
            style: "currency",
            currency: currencyCode,
            maximumFractionDigits: 2
        }).format(number);
    } catch (error) {
        return `${number.toFixed(2)} ${currencyCode}`;
    }
}

function formatPercent(value) {
    const number = Number(value || 0);
    return `${(number * 100).toFixed(2)}%`;
}

function formatDecimal(value) {
    const number = Number(value || 0);
    return number.toFixed(2);
}

function formatDateTime(value) {
    if (!value) {
        return "-";
    }
    return value.replace("T", " ").slice(0, 16);
}

function toDateTimeLocalValue(value) {
    if (!value) {
        return "";
    }
    return value.slice(0, 16);
}

function currentDateTimeLocal() {
    return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function currentMonthText() {
    return currentDateTimeLocal().slice(0, 7);
}

function sortTransactionsDesc(left, right) {
    const leftTime = left.transactionTime || "";
    const rightTime = right.transactionTime || "";
    if (leftTime === rightTime) {
        return Number(right.id || 0) - Number(left.id || 0);
    }
    return rightTime.localeCompare(leftTime);
}

function parseStoredNumber(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseRequiredNumber(value, message) {
    const parsed = parseStoredNumber(value);
    if (parsed === null) {
        throw new Error(message);
    }
    return parsed;
}

function parseRequiredDecimal(value, message) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(message);
    }
    return Number(parsed.toFixed(2));
}

function normalizeNullableDecimal(value) {
    if (value === null || value === undefined || String(value).trim() === "") {
        return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error("请输入合法数字。");
    }
    return Number(parsed.toFixed(2));
}

function normalizeNullableNumber(value) {
    return parseStoredNumber(value);
}

function normalizeNullableInteger(value) {
    if (value === null || value === undefined || String(value).trim() === "") {
        return null;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
        throw new Error("请输入整数日期。");
    }
    return parsed;
}

function normalizeRequiredText(value, message) {
    const text = normalizeText(value);
    if (!text) {
        throw new Error(message);
    }
    return text;
}

function normalizeText(value) {
    const trimmed = String(value || "").trim();
    return trimmed ? trimmed : null;
}

function normalizeNullableDate(value) {
    return value ? value : null;
}

function parseRequiredDateTime(value, message) {
    if (!value) {
        throw new Error(message);
    }
    return value.length === 16 ? `${value}:00` : value;
}

function extractErrorMessage(payload) {
    if (!payload) {
        return null;
    }
    if (typeof payload === "string") {
        return payload;
    }
    if (payload.message) {
        return payload.message;
    }
    if (payload.error) {
        return payload.error;
    }
    return null;
}

function persistNumber(key, value) {
    if (value === null || value === undefined || value === "") {
        localStorage.removeItem(key);
        return;
    }
    localStorage.setItem(key, String(value));
}

function safeText(value) {
    return value === null || value === undefined || value === "" ? "-" : String(value);
}

function escapeHtml(value) {
    return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll("\"", "&quot;")
            .replaceAll("'", "&#39;");
}

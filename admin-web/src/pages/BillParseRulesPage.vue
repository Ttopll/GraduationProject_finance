<template>
  <section class="page-section">
    <article v-if="!familyId" class="panel-card">
      <div class="panel-head">
        <div>
          <div class="panel-kicker">&#23478;&#24237;&#19978;&#19979;&#25991;&#32570;&#22833;</div>
          <h2>&#35831;&#20808;&#21019;&#24314;&#25110;&#21152;&#20837;&#23478;&#24237;</h2>
        </div>
      </div>
      <div class="feedback-box info">
        &#36134;&#21333;&#35299;&#26512;&#35268;&#21017;&#20381;&#36182;&#24403;&#21069;&#23478;&#24237;&#65292;&#19988;&#38656;&#35201;&#23478;&#24237; Owner &#26435;&#38480;&#25165;&#33021;&#32534;&#36753;&#12290;
      </div>
    </article>

    <div class="stats-grid">
      <StatCard label="&#24403;&#21069;&#23478;&#24237;" :value="familyId || '-'" meta="&#35299;&#26512;&#35268;&#21017;&#25353; familyId &#38548;&#31163;" />
      <StatCard label="&#35268;&#21017;&#24635;&#25968;" :value="rules.length" meta="&#21253;&#21547;&#20851;&#38190;&#35789;&#21644;&#27491;&#21017;&#35268;&#21017;" />
      <StatCard label="&#21551;&#29992;&#35268;&#21017;" :value="enabledCount" :meta="disabledMeta" />
      <StatCard label="&#32047;&#35745;&#21629;&#20013;" :value="totalHits" meta="&#26469;&#33258;&#21518;&#31471;&#21629;&#20013;&#32479;&#35745;" />
    </div>

    <AdminTableCard kicker="&#35299;&#26512;&#35268;&#21017;" title="&#36134;&#21333;&#35299;&#26512;&#35268;&#21017;">
      <template #actions>
        <button class="primary-button" type="button" @click="openCreate">&#26032;&#22686;&#35268;&#21017;</button>
        <button class="ghost-button" type="button" @click="refreshAll">&#21047;&#26032;</button>
      </template>
      <template #filters>
        <FilterBar>
          <label class="field-inline field-inline-short">
            <span>&#29366;&#24577;</span>
            <select v-model="filter.enabled" class="field-input">
              <option value="">&#20840;&#37096;</option>
              <option value="1">&#21551;&#29992;</option>
              <option value="0">&#20572;&#29992;</option>
            </select>
          </label>
          <label class="field-inline field-inline-short">
            <span>&#20998;&#31867;</span>
            <select v-model="filter.categoryId" class="field-input">
              <option value="">&#20840;&#37096;</option>
              <option v-for="item in categories" :key="item.id" :value="String(item.id)">{{ item.categoryName }}</option>
            </select>
          </label>
          <label class="field-inline">
            <span>&#20851;&#38190;&#23383;</span>
            <input v-model.trim="filter.keyword" class="field-input" type="text" placeholder="merchant / regex" />
          </label>
        </FilterBar>
      </template>
      <template #feedback>
        <div v-if="feedback" class="feedback-box info">{{ feedback }}</div>
      </template>
      <div class="table-shell">
        <table class="admin-table">
          <thead>
            <tr>
              <th>&#35268;&#21017;&#20449;&#24687;</th>
              <th>&#30446;&#26631;&#20998;&#31867;</th>
              <th>&#20248;&#20808;&#32423;</th>
              <th>&#21629;&#20013;&#24773;&#20917;</th>
              <th>&#29366;&#24577;</th>
              <th>&#25805;&#20316;</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredRules" :key="item.id">
              <td>
                <div class="primary-cell">{{ item.merchantKeyword || "\u65e0\u5546\u6237\u5173\u952e\u8bcd" }}</div>
                <div class="secondary-cell">{{ item.regexPattern || "\u65e0\u6b63\u5219\u8868\u8fbe\u5f0f" }}</div>
              </td>
              <td>{{ item.categoryName || categoryName(item.categoryId) }}</td>
              <td>{{ item.priority ?? "-" }}</td>
              <td>
                <div class="primary-cell">{{ item.hitCount || 0 }} &#27425;</div>
                <div class="secondary-cell">{{ formatDateTime(item.lastHitAt) }}</div>
              </td>
              <td>
                <span class="status-badge" :class="Number(item.enabled) === 1 ? 'is-success' : 'is-muted'">
                  {{ Number(item.enabled) === 1 ? "\u542f\u7528" : "\u505c\u7528" }}
                </span>
              </td>
              <td>
                <div class="row-actions row-actions-left">
                  <button class="ghost-button small" type="button" @click="openEdit(item)">&#32534;&#36753;</button>
                  <button class="ghost-button small" type="button" @click="toggleRule(item)">{{ Number(item.enabled) === 1 ? "\u505c\u7528" : "\u542f\u7528" }}</button>
                  <button class="ghost-button danger small" type="button" @click="deleteRule(item.id)">&#21024;&#38500;</button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredRules.length === 0"><td colspan="6" class="table-empty">&#24403;&#21069;&#31579;&#36873;&#26465;&#20214;&#19979;&#26242;&#26080;&#35299;&#26512;&#35268;&#21017;&#25968;&#25454;&#12290;</td></tr>
          </tbody>
        </table>
      </div>
    </AdminTableCard>

    <CrudModal v-model="showModal" :title="form.id ? '\u7f16\u8f91\u89e3\u6790\u89c4\u5219' : '\u65b0\u589e\u89e3\u6790\u89c4\u5219'">
      <div class="form-grid">
        <label class="field-block">
          <span>&#30446;&#26631;&#20998;&#31867;</span>
          <select v-model.number="form.categoryId" class="field-input">
            <option :value="null">&#35831;&#36873;&#25321;</option>
            <option v-for="item in categories" :key="item.id" :value="item.id">{{ item.categoryName }}</option>
          </select>
        </label>
        <label class="field-block">
          <span>&#20248;&#20808;&#32423;</span>
          <input v-model.number="form.priority" class="field-input" type="number" min="1" />
        </label>
        <label class="field-block field-block-full">
          <span>&#21830;&#25143;&#20851;&#38190;&#23383;</span>
          <input v-model.trim="form.merchantKeyword" class="field-input" type="text" placeholder="&#20363;&#22914;&#65306;&#32654;&#22242;&#12289;&#28120;&#23453;" />
        </label>
        <label class="field-block field-block-full">
          <span>Regex Pattern</span>
          <input v-model.trim="form.regexPattern" class="field-input" type="text" placeholder="&#21487;&#36873;&#65292;&#29992;&#20110;&#26356;&#31934;&#30830;&#30340;&#21305;&#37197;" />
        </label>
      </div>
      <div class="feedback-box info">{{ formTip }}</div>
      <div class="button-row">
        <button class="primary-button" type="button" @click="submitRule">{{ form.id ? "\u4fdd\u5b58\u89e3\u6790\u89c4\u5219" : "\u521b\u5efa\u89e3\u6790\u89c4\u5219" }}</button>
      </div>
    </CrudModal>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import StatCard from "@/components/StatCard.vue";
import AdminTableCard from "@/components/AdminTableCard.vue";
import CrudModal from "@/components/CrudModal.vue";
import FilterBar from "@/components/FilterBar.vue";
import { authStore } from "@/stores/auth";
import { categoriesApi } from "@/api/categories";
import { billParseRulesApi } from "@/api/billParseRules";
import { usePageRefresh } from "@/composables/pageRefresh";

const familyId = computed(() => authStore.currentFamilyId);
const categories = ref([]);
const rules = ref([]);
const feedback = ref("");
const showModal = ref(false);

const filter = reactive({
  enabled: "",
  categoryId: "",
  keyword: ""
});

const form = reactive({
  id: null,
  categoryId: null,
  merchantKeyword: "",
  regexPattern: "",
  priority: 10
});

const enabledCount = computed(() => rules.value.filter((item) => Number(item.enabled) === 1).length);
const disabledMeta = computed(() => `\u505c\u7528 ${rules.value.filter((item) => Number(item.enabled) !== 1).length} \u6761`);
const totalHits = computed(() => rules.value.reduce((sum, item) => sum + Number(item.hitCount || 0), 0));
const filteredRules = computed(() => rules.value.filter((item) => {
  if (filter.enabled !== "" && Number(item.enabled) !== Number(filter.enabled)) {
    return false;
  }
  if (filter.categoryId !== "" && Number(item.categoryId) !== Number(filter.categoryId)) {
    return false;
  }
  if (filter.keyword) {
    const text = `${item.merchantKeyword || ""} ${item.regexPattern || ""}`.toLowerCase();
    if (!text.includes(filter.keyword.toLowerCase())) {
      return false;
    }
  }
  return true;
}));
const formTip = computed(() => "\u5efa\u8bae\u4f18\u5148\u586b\u5199\u5546\u6237\u5173\u952e\u8bcd\uff0cregex \u7528\u4e8e\u8865\u5145\u7cbe\u51c6\u5339\u914d\u3002\u4f18\u5148\u7ea7\u8d8a\u5c0f\uff0c\u89e3\u6790\u65f6\u8d8a\u9760\u524d\u6267\u884c\u3002");

function ensureFamilyId() {
  if (!familyId.value) {
    throw new Error("\u5f53\u524d\u4f1a\u8bdd\u6ca1\u6709\u53ef\u7528\u7684\u5bb6\u5ead\u4e0a\u4e0b\u6587\u3002");
  }
  return familyId.value;
}

function resetForm() {
  Object.assign(form, {
    id: null,
    categoryId: null,
    merchantKeyword: "",
    regexPattern: "",
    priority: 10
  });
}

function openCreate() {
  resetForm();
  showModal.value = true;
}

function openEdit(item) {
  Object.assign(form, {
    id: item.id,
    categoryId: item.categoryId,
    merchantKeyword: item.merchantKeyword || "",
    regexPattern: item.regexPattern || "",
    priority: item.priority ?? 10
  });
  showModal.value = true;
}

async function loadCategories() {
  categories.value = await categoriesApi.listByFamily(ensureFamilyId());
}

async function loadRules() {
  rules.value = await billParseRulesApi.list(ensureFamilyId());
}

async function refreshAll() {
  if (!familyId.value) {
    feedback.value = "\u5f53\u524d\u8d26\u53f7\u8fd8\u6ca1\u6709\u5bb6\u5ead\u4e0a\u4e0b\u6587\uff0c\u8bf7\u5148\u5728\u201c\u7528\u6237\u4e0e\u5bb6\u5ead\u201d\u4e2d\u521b\u5efa\u5bb6\u5ead\u6216\u52a0\u5165\u5bb6\u5ead\u3002";
    return;
  }
  await Promise.all([loadCategories(), loadRules()]);
}

async function submitRule() {
  try {
    if (!form.categoryId) {
      throw new Error("\u8bf7\u5148\u9009\u62e9\u76ee\u6807\u5206\u7c7b\u3002");
    }
    if (!form.merchantKeyword && !form.regexPattern) {
      throw new Error("\u5546\u6237\u5173\u952e\u8bcd\u548c regex \u81f3\u5c11\u586b\u4e00\u9879\u3002");
    }
    const payload = {
      categoryId: Number(form.categoryId),
      merchantKeyword: form.merchantKeyword || null,
      regexPattern: form.regexPattern || null,
      priority: form.priority ?? 10
    };
    if (form.id) {
      await billParseRulesApi.update(form.id, payload);
      feedback.value = "\u89e3\u6790\u89c4\u5219\u5df2\u66f4\u65b0\u3002";
    } else {
      await billParseRulesApi.create({ familyId: ensureFamilyId(), ...payload });
      feedback.value = "\u89e3\u6790\u89c4\u5219\u5df2\u521b\u5efa\u3002";
    }
    showModal.value = false;
    resetForm();
    await loadRules();
  } catch (error) {
    feedback.value = `\u89e3\u6790\u89c4\u5219\u64cd\u4f5c\u5931\u8d25\uff1a${error.message}`;
  }
}

async function toggleRule(item) {
  try {
    if (Number(item.enabled) === 1) {
      await billParseRulesApi.disable(item.id);
    } else {
      await billParseRulesApi.enable(item.id);
    }
    await loadRules();
  } catch (error) {
    feedback.value = `\u5207\u6362\u89e3\u6790\u89c4\u5219\u72b6\u6001\u5931\u8d25\uff1a${error.message}`;
  }
}

async function deleteRule(ruleId) {
  try {
    await billParseRulesApi.remove(ruleId);
    await loadRules();
  } catch (error) {
    feedback.value = `\u5220\u9664\u89e3\u6790\u89c4\u5219\u5931\u8d25\uff1a${error.message}`;
  }
}

function categoryName(categoryId) {
  return categories.value.find((item) => item.id === categoryId)?.categoryName || `#${categoryId}`;
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

onMounted(async () => {
  try {
    await refreshAll();
  } catch (error) {
    feedback.value = `\u89e3\u6790\u89c4\u5219\u521d\u59cb\u52a0\u8f7d\u5931\u8d25\uff1a${error.message}`;
  }
});

usePageRefresh(refreshAll);
</script>

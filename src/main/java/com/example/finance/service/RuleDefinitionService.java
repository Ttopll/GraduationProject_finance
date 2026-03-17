package com.example.finance.service;

import com.example.finance.dto.RuleDefinitionApiModels;
import com.example.finance.entity.Category;
import com.example.finance.entity.FamilyMember;
import com.example.finance.entity.RuleDefinition;
import com.example.finance.repository.CategoryRepository;
import com.example.finance.repository.FamilyMemberRepository;
import com.example.finance.repository.RuleDefinitionRepository;
import com.example.finance.util.RuleThresholdConfigUtil;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;

@Service
public class RuleDefinitionService {

    private final RuleDefinitionRepository ruleDefinitionRepository;
    private final CategoryRepository categoryRepository;
    private final FamilyMemberRepository familyMemberRepository;
    private final FamilyService familyService;

    public RuleDefinitionService(
            RuleDefinitionRepository ruleDefinitionRepository,
            CategoryRepository categoryRepository,
            FamilyMemberRepository familyMemberRepository,
            FamilyService familyService
    ) {
        this.ruleDefinitionRepository = ruleDefinitionRepository;
        this.categoryRepository = categoryRepository;
        this.familyMemberRepository = familyMemberRepository;
        this.familyService = familyService;
    }

    @Transactional
    public RuleDefinition create(RuleDefinitionApiModels.CreateRequest request) {
        familyService.getById(request.familyId());
        if (request.categoryId() != null) {
            Category category = categoryRepository.findById(request.categoryId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "规则分类不存在"));
            if (!request.familyId().equals(category.getFamilyId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "规则分类不属于当前家庭");
            }
        }
        if (request.createdByMemberId() != null) {
            FamilyMember familyMember = familyMemberRepository.findById(request.createdByMemberId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "规则创建人不存在"));
            if (!request.familyId().equals(familyMember.getFamilyId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "规则创建人不属于当前家庭");
            }
        }

        String ruleType = request.ruleType().trim().toUpperCase(Locale.ROOT);
        String metricType = request.metricType().trim().toUpperCase(Locale.ROOT);
        String timeScope = request.timeScope().trim().toUpperCase(Locale.ROOT);
        String operatorType = request.operatorType().trim().toUpperCase(Locale.ROOT);
        String actionType = request.actionType().trim().toUpperCase(Locale.ROOT);
        String normalizedThresholdJson;

        if (!List.of("THRESHOLD", "CONSECUTIVE_THRESHOLD", "TREND_ANOMALY").contains(ruleType)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "当前仅支持 THRESHOLD、CONSECUTIVE_THRESHOLD 或 TREND_ANOMALY 规则"
            );
        }
        if (!List.of("CATEGORY_EXPENSE", "FAMILY_EXPENSE").contains(metricType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前仅支持 CATEGORY_EXPENSE 或 FAMILY_EXPENSE 指标");
        }
        if (!List.of("MONTH", "YEAR").contains(timeScope)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "规则时间范围仅支持 MONTH 或 YEAR");
        }
        if (!List.of("GT", "GTE", "LT", "LTE", "EQ").contains(operatorType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不支持的比较运算符");
        }
        if (!"NOTIFY".equals(actionType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前仅支持 NOTIFY 动作");
        }
        if ("CATEGORY_EXPENSE".equals(metricType) && request.categoryId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CATEGORY_EXPENSE 规则必须指定 categoryId");
        }
        if ("CONSECUTIVE_THRESHOLD".equals(ruleType) && !"MONTH".equals(timeScope)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CONSECUTIVE_THRESHOLD 规则仅支持 MONTH 时间范围");
        }
        if ("TREND_ANOMALY".equals(ruleType) && !"MONTH".equals(timeScope)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "TREND_ANOMALY 规则仅支持 MONTH 时间范围");
        }
        if ("TREND_ANOMALY".equals(ruleType) && !List.of("GT", "GTE").contains(operatorType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "TREND_ANOMALY 规则仅支持 GT 或 GTE 运算符");
        }
        try {
            normalizedThresholdJson = RuleThresholdConfigUtil.normalizeThresholdJson(ruleType, request.thresholdJson());
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage());
        }

        RuleDefinition ruleDefinition = new RuleDefinition();
        ruleDefinition.setFamilyId(request.familyId());
        ruleDefinition.setCategoryId(request.categoryId());
        ruleDefinition.setCreatedByMemberId(request.createdByMemberId());
        ruleDefinition.setRuleName(request.ruleName().trim());
        ruleDefinition.setRuleType(ruleType);
        ruleDefinition.setMetricType(metricType);
        ruleDefinition.setTimeScope(timeScope);
        ruleDefinition.setOperatorType(operatorType);
        ruleDefinition.setThresholdValue(request.thresholdValue());
        ruleDefinition.setThresholdJson(normalizedThresholdJson);
        ruleDefinition.setActionType(actionType);
        ruleDefinition.setMessageTemplate(request.messageTemplate().trim());
        ruleDefinition.setEnabled(1);
        ruleDefinition.setPriority(request.priority() == null ? 100 : request.priority());
        return ruleDefinitionRepository.save(ruleDefinition);
    }

    public List<RuleDefinition> listByFamilyId(Long familyId) {
        familyService.getById(familyId);
        return ruleDefinitionRepository.findByFamilyIdOrderByPriorityAscIdAsc(familyId);
    }
}

/**
 * Verum Omnis Rules Engine
 * Implements the forensic analysis logic based on Verum Constitution
 */

class RulesEngine {
    constructor() {
        this.legalSubjects = [
            {
                name: "Shareholder Oppression",
                keywords: ["denied meeting", "withheld financial", "exclusion", "minority", "blocked", "prevented access"],
                severity: "HIGH"
            },
            {
                name: "Breach of Fiduciary Duty",
                keywords: ["self-dealing", "conflict of interest", "personal benefit", "breach of trust", "misappropriation"],
                severity: "HIGH"
            },
            {
                name: "Cybercrime",
                keywords: ["unauthorized access", "gmail", "device logs", "hacking", "password", "account access", "data theft"],
                severity: "CRITICAL"
            },
            {
                name: "Fraud",
                keywords: ["misrepresentation", "false statement", "deceived", "forged", "fabricated", "falsified"],
                severity: "CRITICAL"
            },
            {
                name: "Financial Manipulation",
                keywords: ["hidden income", "undisclosed", "off-books", "diverted funds", "unexplained transfers"],
                severity: "HIGH"
            },
            {
                name: "Coercion",
                keywords: ["threatened", "forced", "pressured", "intimidated", "blackmail", "ultimatum"],
                severity: "CRITICAL"
            },
            {
                name: "Rights Violation",
                keywords: ["denied rights", "discriminated", "violated privacy", "harassment", "abuse"],
                severity: "HIGH"
            }
        ];

        this.dishonestyMatrix = {
            contradictions: {
                weight: 3,
                patterns: [
                    { regex: /no deal.*invoice|invoice.*no deal/gi, description: "Deal denial contradicted by invoice" },
                    { regex: /denied.*admitted|admitted.*denied/gi, description: "Admission contradicts denial" },
                    { regex: /refused.*accepted|accepted.*refused/gi, description: "Acceptance contradicts refusal" },
                    { regex: /never.*always|always.*never/gi, description: "Absolute contradiction detected" },
                    { regex: /no access.*logged in|logged in.*no access/gi, description: "Access denial contradicted by login records" }
                ]
            },
            omissions: {
                weight: 2,
                patterns: [
                    { regex: /cropped screenshot|partial image/gi, description: "Evidence appears cropped or partial" },
                    { regex: /selective editing|edited version/gi, description: "Selective editing detected" },
                    { regex: /missing context|without context/gi, description: "Context appears to be missing" },
                    { regex: /redacted(?! by court| for privacy)/gi, description: "Unexplained redaction" }
                ]
            },
            deflection: {
                weight: 2,
                patterns: [
                    { regex: /but they did|what about|you also/gi, description: "Deflection pattern detected" },
                    { regex: /that's different|not the same/gi, description: "False distinction attempt" }
                ]
            }
        };

        this.extractionProtocol = {
            step1Keywords: ["admin", "deny", "forged", "access", "delete", "refuse", "invoice", "profit", "hide", "secret"],
            step2Tags: ["#Cybercrime", "#Fraud", "#Oppression", "#FiduciaryBreach", "#Coercion", "#RightsViolation"],
            step3Scoring: {
                low: { weight: 1, threshold: 2 },
                medium: { weight: 2, threshold: 5 },
                high: { weight: 3, threshold: 10 }
            }
        };

        this.contradictionLayers = [
            "timeline analysis",
            "statement comparison",
            "behavioural inconsistencies",
            "document metadata mismatches",
            "financial flows",
            "coercion indicators",
            "rights violations",
            "intent vs action mismatch"
        ];
    }

    /**
     * Analyze text for legal subjects
     */
    analyzeLegalSubjects(text) {
        const findings = [];
        const lowerText = text.toLowerCase();

        for (const subject of this.legalSubjects) {
            const matchedKeywords = subject.keywords.filter(keyword => 
                lowerText.includes(keyword.toLowerCase())
            );

            if (matchedKeywords.length > 0) {
                findings.push({
                    subject: subject.name,
                    severity: subject.severity,
                    matchedKeywords: matchedKeywords,
                    confidence: Math.min(100, matchedKeywords.length * 25)
                });
            }
        }

        return findings;
    }

    /**
     * Detect contradictions in text
     */
    detectContradictions(text) {
        const contradictions = [];

        for (const [type, config] of Object.entries(this.dishonestyMatrix)) {
            for (const pattern of config.patterns) {
                const matches = text.match(pattern.regex);
                if (matches) {
                    contradictions.push({
                        type: type,
                        weight: config.weight,
                        description: pattern.description,
                        matches: matches,
                        layer: this.identifyLayer(type)
                    });
                }
            }
        }

        return contradictions;
    }

    /**
     * Identify which contradiction layer applies
     */
    identifyLayer(type) {
        const layerMap = {
            contradictions: "statement comparison",
            omissions: "document metadata mismatches",
            deflection: "behavioural inconsistencies"
        };
        return layerMap[type] || "general analysis";
    }

    /**
     * Calculate dishonesty score (0-10)
     */
    calculateDishonestyScore(text) {
        let score = 0;
        const findings = [];

        // Check extraction keywords
        const lowerText = text.toLowerCase();
        for (const keyword of this.extractionProtocol.step1Keywords) {
            if (lowerText.includes(keyword)) {
                score += 0.5;
                findings.push(`Keyword detected: "${keyword}"`);
            }
        }

        // Check dishonesty patterns
        for (const [type, config] of Object.entries(this.dishonestyMatrix)) {
            for (const pattern of config.patterns) {
                if (pattern.regex.test(text)) {
                    score += config.weight;
                    findings.push(`${type} pattern: ${pattern.description}`);
                }
            }
        }

        // Normalize to 0-10 scale
        score = Math.min(10, score);

        return {
            score: Math.round(score * 10) / 10,
            findings: findings,
            level: score < 3 ? 'low' : score < 6 ? 'medium' : 'high'
        };
    }

    /**
     * Generate legal tags based on analysis
     */
    generateTags(text) {
        const tags = [];
        const subjects = this.analyzeLegalSubjects(text);

        for (const finding of subjects) {
            let tag = finding.subject.replace(/\s+/g, '');
            tags.push({
                name: `#${tag}`,
                severity: finding.severity
            });
        }

        // Add extraction protocol tags if applicable
        const lowerText = text.toLowerCase();
        for (const tag of this.extractionProtocol.step2Tags) {
            const keywords = tag.toLowerCase().replace('#', '');
            if (lowerText.includes(keywords) || this.tagMatchesContent(tag, lowerText)) {
                if (!tags.find(t => t.name === tag)) {
                    tags.push({ name: tag, severity: 'MEDIUM' });
                }
            }
        }

        return tags;
    }

    /**
     * Check if tag matches content
     */
    tagMatchesContent(tag, text) {
        const tagKeywords = {
            '#Cybercrime': ['hack', 'unauthorized', 'access', 'breach', 'password'],
            '#Fraud': ['fraud', 'false', 'deceive', 'misrepresent', 'forge'],
            '#Oppression': ['oppress', 'exclude', 'deny', 'block', 'prevent'],
            '#FiduciaryBreach': ['fiduciary', 'duty', 'trust', 'breach', 'conflict'],
            '#Coercion': ['force', 'threat', 'pressure', 'intimidate', 'coerce'],
            '#RightsViolation': ['rights', 'violate', 'discriminate', 'harass', 'abuse']
        };

        const keywords = tagKeywords[tag] || [];
        return keywords.some(kw => text.includes(kw));
    }

    /**
     * Perform full analysis
     */
    analyze(text, options = {}) {
        const results = {
            timestamp: new Date().toISOString(),
            textLength: text.length,
            wordCount: text.split(/\s+/).filter(w => w.length > 0).length
        };

        if (options.contradictionEngine !== false) {
            results.contradictions = this.detectContradictions(text);
        }

        if (options.fraudDetection !== false) {
            results.legalSubjects = this.analyzeLegalSubjects(text);
        }

        if (options.dishonestyMatrix !== false) {
            results.dishonestyScore = this.calculateDishonestyScore(text);
        }

        results.tags = this.generateTags(text);

        return results;
    }
}

// Export for use in other modules
window.RulesEngine = RulesEngine;

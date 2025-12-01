/**
 * Verum Omnis Narrative Generator
 * Generates human-readable forensic narratives from analysis results
 */

class NarrativeGenerator {
    constructor() {
        this.templates = {
            introduction: [
                "This forensic analysis was conducted using the Verum Omnis Constitutional Governance Framework.",
                "The following narrative presents findings from automated document analysis with cryptographic integrity sealing.",
                "All findings are presented objectively, following the principles of truth, fairness, and human rights protection."
            ],
            
            noFindings: "The analysis did not identify significant issues requiring attention. The document appears to be consistent and without notable contradictions.",
            
            contradictionIntro: "During multi-pass analysis, the following contradictions were identified:",
            
            legalSubjectIntro: "The analysis identified content relevant to the following legal subjects:",
            
            scoreExplanation: {
                low: "The dishonesty score indicates a low level of concern. However, all findings should be reviewed by qualified professionals.",
                medium: "The moderate dishonesty score suggests areas requiring further investigation. Professional legal review is recommended.",
                high: "The high dishonesty score indicates significant concerns. Immediate professional legal consultation is strongly advised."
            },
            
            conclusion: "This analysis was performed stateless and offline, with no data retention. The cryptographic seal ensures document integrity and provides an immutable timestamp for evidentiary purposes."
        };
    }

    /**
     * Generate complete forensic narrative
     */
    generate(analysisResults, options = {}) {
        const sections = [];

        // Introduction
        sections.push("=== FORENSIC ANALYSIS NARRATIVE ===\n");
        sections.push(this.generateIntroduction());
        sections.push("");

        // Timestamp and basic info
        sections.push(`Analysis Timestamp: ${analysisResults.timestamp}`);
        sections.push(`Document Statistics: ${analysisResults.wordCount} words, ${analysisResults.textLength} characters`);
        sections.push("");

        // Legal Subjects
        if (analysisResults.legalSubjects && analysisResults.legalSubjects.length > 0) {
            sections.push(this.generateLegalSubjectsNarrative(analysisResults.legalSubjects));
            sections.push("");
        }

        // Contradictions
        if (analysisResults.contradictions && analysisResults.contradictions.length > 0) {
            sections.push(this.generateContradictionsNarrative(analysisResults.contradictions));
            sections.push("");
        } else {
            sections.push("Contradiction Analysis: No direct contradictions were detected in the analyzed text.");
            sections.push("");
        }

        // Dishonesty Score
        if (analysisResults.dishonestyScore) {
            sections.push(this.generateScoreNarrative(analysisResults.dishonestyScore));
            sections.push("");
        }

        // Tags Summary
        if (analysisResults.tags && analysisResults.tags.length > 0) {
            sections.push(this.generateTagsSummary(analysisResults.tags));
            sections.push("");
        }

        // Conclusion
        sections.push("=== CONCLUSION ===");
        sections.push(this.templates.conclusion);
        sections.push("");
        sections.push("This document operates under the Verum Omnis Constitutional Governance Layer.");
        sections.push("Creator: Liam Highcock | Verum Global Foundation");

        return sections.join("\n");
    }

    /**
     * Generate introduction section
     */
    generateIntroduction() {
        return this.templates.introduction.join("\n\n");
    }

    /**
     * Generate legal subjects narrative
     */
    generateLegalSubjectsNarrative(legalSubjects) {
        const lines = ["=== LEGAL SUBJECTS IDENTIFIED ==="];
        lines.push(this.templates.legalSubjectIntro);
        lines.push("");

        for (const subject of legalSubjects) {
            const severityEmoji = this.getSeverityEmoji(subject.severity);
            lines.push(`${severityEmoji} ${subject.subject} (${subject.severity} severity)`);
            lines.push(`   Confidence: ${subject.confidence}%`);
            lines.push(`   Matched indicators: ${subject.matchedKeywords.join(', ')}`);
            lines.push("");
        }

        return lines.join("\n");
    }

    /**
     * Generate contradictions narrative
     */
    generateContradictionsNarrative(contradictions) {
        const lines = ["=== CONTRADICTIONS DETECTED ==="];
        lines.push(this.templates.contradictionIntro);
        lines.push("");

        // Group by layer
        const byLayer = {};
        for (const c of contradictions) {
            if (!byLayer[c.layer]) byLayer[c.layer] = [];
            byLayer[c.layer].push(c);
        }

        for (const [layer, items] of Object.entries(byLayer)) {
            lines.push(`📋 ${layer.toUpperCase()}`);
            for (const item of items) {
                lines.push(`   • [${item.type}] ${item.description}`);
                lines.push(`     Weight: ${item.weight}/3 | Impact: ${this.getImpactLevel(item.weight)}`);
            }
            lines.push("");
        }

        const totalWeight = contradictions.reduce((sum, c) => sum + c.weight, 0);
        lines.push(`Total Contradiction Weight: ${totalWeight}`);
        lines.push(`Assessment: ${this.getContradictionAssessment(totalWeight)}`);

        return lines.join("\n");
    }

    /**
     * Generate score narrative
     */
    generateScoreNarrative(scoreData) {
        const lines = ["=== DISHONESTY ANALYSIS ==="];
        lines.push(`Score: ${scoreData.score}/10 (${scoreData.level.toUpperCase()} concern level)`);
        lines.push("");
        lines.push(this.templates.scoreExplanation[scoreData.level]);
        lines.push("");
        
        if (scoreData.findings && scoreData.findings.length > 0) {
            lines.push("Contributing factors:");
            for (const finding of scoreData.findings.slice(0, 10)) {
                lines.push(`   • ${finding}`);
            }
            if (scoreData.findings.length > 10) {
                lines.push(`   ... and ${scoreData.findings.length - 10} more factors`);
            }
        }

        return lines.join("\n");
    }

    /**
     * Generate tags summary
     */
    generateTagsSummary(tags) {
        const lines = ["=== CLASSIFICATION TAGS ==="];
        
        const critical = tags.filter(t => t.severity === 'CRITICAL');
        const high = tags.filter(t => t.severity === 'HIGH');
        const other = tags.filter(t => !['CRITICAL', 'HIGH'].includes(t.severity));

        if (critical.length > 0) {
            lines.push(`🚨 CRITICAL: ${critical.map(t => t.name).join(', ')}`);
        }
        if (high.length > 0) {
            lines.push(`⚠️ HIGH: ${high.map(t => t.name).join(', ')}`);
        }
        if (other.length > 0) {
            lines.push(`📌 OTHER: ${other.map(t => t.name).join(', ')}`);
        }

        return lines.join("\n");
    }

    /**
     * Get severity emoji
     */
    getSeverityEmoji(severity) {
        const emojis = {
            'CRITICAL': '🚨',
            'HIGH': '⚠️',
            'MEDIUM': '📋',
            'LOW': '📝'
        };
        return emojis[severity] || '📄';
    }

    /**
     * Get impact level description
     */
    getImpactLevel(weight) {
        if (weight >= 3) return 'High Impact';
        if (weight >= 2) return 'Moderate Impact';
        return 'Low Impact';
    }

    /**
     * Get contradiction assessment
     */
    getContradictionAssessment(totalWeight) {
        if (totalWeight >= 10) {
            return 'SEVERE - Multiple significant contradictions indicate potential deliberate misrepresentation.';
        }
        if (totalWeight >= 5) {
            return 'MODERATE - Notable contradictions require professional review and explanation.';
        }
        if (totalWeight >= 2) {
            return 'MINOR - Some inconsistencies detected that may warrant clarification.';
        }
        return 'MINIMAL - Few or no significant contradictions detected.';
    }

    /**
     * Generate executive summary
     */
    generateExecutiveSummary(analysisResults) {
        const summary = [];
        summary.push("EXECUTIVE SUMMARY");
        summary.push("─".repeat(40));
        
        const issues = [];
        
        if (analysisResults.legalSubjects?.length > 0) {
            issues.push(`${analysisResults.legalSubjects.length} legal subject(s) identified`);
        }
        
        if (analysisResults.contradictions?.length > 0) {
            issues.push(`${analysisResults.contradictions.length} contradiction(s) detected`);
        }
        
        if (analysisResults.dishonestyScore?.score >= 5) {
            issues.push(`Elevated dishonesty score (${analysisResults.dishonestyScore.score}/10)`);
        }

        if (issues.length === 0) {
            summary.push("No significant issues identified in the analyzed content.");
        } else {
            summary.push("Key findings:");
            for (const issue of issues) {
                summary.push(`• ${issue}`);
            }
        }

        return summary.join("\n");
    }
}

// Export for use in other modules
window.NarrativeGenerator = NarrativeGenerator;

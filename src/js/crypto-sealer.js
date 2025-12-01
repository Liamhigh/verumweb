/**
 * Verum Omnis Cryptographic PDF Sealer
 * Implements SHA-512/SHA-256 hashing and PDF generation with forensic sealing
 * Uses pure JavaScript PDF generation (no external dependencies)
 */

// Constants for PDF generation
const PDF_MARGIN = 50;
const PDF_LINE_HEIGHT = 12;
const PDF_PAGE_WIDTH = 612;
const PDF_PAGE_HEIGHT = 792;

class CryptoSealer {
    constructor() {
        this.watermark = "VERUM OMNIS FORENSIC SEAL";
        this.version = "1.0";
    }

    /**
     * Generate SHA-512 hash
     */
    async sha512(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-512', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Generate SHA-256 hash
     */
    async sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Generate cryptographic seal for content
     */
    async generateSeal(content, hashType = 'SHA-512') {
        const timestamp = new Date().toISOString();
        const sealData = `${content}|${timestamp}|VERUM_OMNIS_SEAL`;
        
        const hash = hashType === 'SHA-256' 
            ? await this.sha256(sealData)
            : await this.sha512(sealData);

        return {
            hash: hash,
            timestamp: timestamp,
            algorithm: hashType,
            version: this.version
        };
    }

    /**
     * Create sealed PDF document using pure JavaScript
     */
    async createSealedPDF(analysisResults, narrative, options = {}) {
        // Generate seal first
        const sealContent = JSON.stringify(analysisResults) + narrative;
        const seal = await this.generateSeal(sealContent, options.hashType || 'SHA-512');

        // Build PDF content
        const pdfContent = this.buildPDFContent(analysisResults, narrative, seal);

        return {
            pdf: pdfContent,
            seal: seal
        };
    }

    /**
     * Build PDF content structure
     */
    buildPDFContent(analysisResults, narrative, seal) {
        const lines = [];
        
        // Header
        lines.push('═══════════════════════════════════════════════════════════════════');
        lines.push('                         VERUM OMNIS');
        lines.push('                  Forensic Analysis Report');
        lines.push('              Cryptographically Sealed Document');
        lines.push('═══════════════════════════════════════════════════════════════════');
        lines.push('');
        
        // Integrity Seal
        lines.push('┌─────────────────────────────────────────────────────────────────┐');
        lines.push('│ 🔐 CRYPTOGRAPHIC INTEGRITY SEAL                                 │');
        lines.push('├─────────────────────────────────────────────────────────────────┤');
        lines.push(`│ Algorithm: ${seal.algorithm}`);
        lines.push(`│ Hash: ${seal.hash.substring(0, 60)}...`);
        lines.push(`│ Timestamp: ${seal.timestamp}`);
        lines.push(`│ Version: ${seal.version}`);
        lines.push('└─────────────────────────────────────────────────────────────────┘');
        lines.push('');
        
        // Analysis Summary
        lines.push('📊 ANALYSIS SUMMARY');
        lines.push('───────────────────────────────────────────────────────────────────');
        lines.push(`• Document analyzed: ${analysisResults.timestamp}`);
        lines.push(`• Text length: ${analysisResults.textLength} characters`);
        lines.push(`• Word count: ${analysisResults.wordCount} words`);
        lines.push(`• Contradictions found: ${analysisResults.contradictions?.length || 0}`);
        lines.push(`• Legal subjects identified: ${analysisResults.legalSubjects?.length || 0}`);
        lines.push(`• Dishonesty score: ${analysisResults.dishonestyScore?.score || 0}/10`);
        lines.push('');
        
        // Legal Tags
        if (analysisResults.tags && analysisResults.tags.length > 0) {
            lines.push('🏷️ LEGAL SUBJECT TAGS');
            lines.push('───────────────────────────────────────────────────────────────────');
            for (const tag of analysisResults.tags) {
                lines.push(`  ${tag.name} (${tag.severity})`);
            }
            lines.push('');
        }
        
        // Contradictions
        if (analysisResults.contradictions && analysisResults.contradictions.length > 0) {
            lines.push('⚠️ CONTRADICTIONS DETECTED');
            lines.push('───────────────────────────────────────────────────────────────────');
            for (const c of analysisResults.contradictions) {
                lines.push(`  • [${c.type.toUpperCase()}] ${c.description}`);
                lines.push(`    Layer: ${c.layer} | Weight: ${c.weight}/3`);
            }
            lines.push('');
        }

        // Legal Subjects
        if (analysisResults.legalSubjects && analysisResults.legalSubjects.length > 0) {
            lines.push('⚖️ LEGAL SUBJECTS IDENTIFIED');
            lines.push('───────────────────────────────────────────────────────────────────');
            for (const subject of analysisResults.legalSubjects) {
                lines.push(`  • ${subject.subject} (${subject.severity})`);
                lines.push(`    Confidence: ${subject.confidence}%`);
                lines.push(`    Keywords: ${subject.matchedKeywords.join(', ')}`);
            }
            lines.push('');
        }
        
        // Narrative
        lines.push('📖 FORENSIC NARRATIVE');
        lines.push('───────────────────────────────────────────────────────────────────');
        // Split narrative into lines
        const narrativeLines = narrative.split('\n');
        for (const line of narrativeLines) {
            lines.push(line);
        }
        lines.push('');
        
        // Footer
        lines.push('═══════════════════════════════════════════════════════════════════');
        lines.push('VERUM OMNIS FORENSIC ENGINE | Constitutional Governance');
        lines.push(`Integrity Seal: ${seal.hash.substring(0, 32)}...`);
        lines.push('Created by Liam Highcock | Verum Global Foundation');
        lines.push('═══════════════════════════════════════════════════════════════════');
        
        return {
            content: lines.join('\n'),
            lines: lines,
            seal: seal
        };
    }

    /**
     * Escape special characters for PDF strings
     */
    escapePDFString(str) {
        return str
            .replace(/\\/g, '\\\\')
            .replace(/\(/g, '\\(')
            .replace(/\)/g, '\\)')
            .replace(/\r\n/g, ' ')
            .replace(/\n/g, ' ')
            .replace(/\r/g, ' ')
            .replace(/\t/g, '    ');
    }

    /**
     * Generate PDF using basic PDF structure
     */
    generatePDFBytes(content, seal) {
        // Create a simple PDF 1.4 document
        const textContent = typeof content === 'string' ? content : content.content;
        const lines = textContent.split('\n');
        
        // PDF structure
        let pdf = '%PDF-1.4\n';
        let objectCount = 0;
        const objects = [];
        
        // Catalog
        objectCount++;
        objects.push(`${objectCount} 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
        
        // Pages
        objectCount++;
        objects.push(`${objectCount} 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);
        
        // Page
        objectCount++;
        objects.push(`${objectCount} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`);
        
        // Content stream
        let contentStream = 'BT\n/F1 10 Tf\n';
        let yPos = PDF_PAGE_HEIGHT - PDF_MARGIN;
        for (const line of lines) {
            if (yPos < PDF_MARGIN) break;
            const escapedLine = this.escapePDFString(line);
            contentStream += `${PDF_MARGIN} ${yPos} Td\n(${escapedLine}) Tj\n0 -${PDF_LINE_HEIGHT} Td\n`;
            yPos -= PDF_LINE_HEIGHT;
        }
        contentStream += 'ET';
        
        objectCount++;
        objects.push(`${objectCount} 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`);
        
        // Font
        objectCount++;
        objects.push(`${objectCount} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n`);
        
        // Build PDF
        for (const obj of objects) {
            pdf += obj;
        }
        
        // Cross-reference table
        pdf += 'xref\n';
        pdf += `0 ${objectCount + 1}\n`;
        pdf += '0000000000 65535 f \n';
        
        let offset = 9; // After %PDF-1.4\n
        for (let i = 0; i < objects.length; i++) {
            pdf += String(offset).padStart(10, '0') + ' 00000 n \n';
            offset += objects[i].length;
        }
        
        // Trailer
        pdf += 'trailer\n';
        pdf += `<< /Size ${objectCount + 1} /Root 1 0 R >>\n`;
        pdf += 'startxref\n';
        pdf += `${offset}\n`;
        pdf += '%%EOF';
        
        return pdf;
    }

    /**
     * Download the sealed PDF
     */
    downloadPDF(pdfData, filename = 'verum-omnis-forensic-report.pdf') {
        const content = pdfData.content || pdfData;
        const seal = pdfData.seal;
        
        // Generate actual PDF bytes
        const pdfBytes = this.generatePDFBytes(content, seal);
        
        // Create blob and download
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Verify document integrity
     */
    async verifyIntegrity(content, expectedHash, hashType = 'SHA-512') {
        const computedHash = hashType === 'SHA-256'
            ? await this.sha256(content)
            : await this.sha512(content);
        
        return {
            valid: computedHash === expectedHash,
            computedHash: computedHash,
            expectedHash: expectedHash
        };
    }
}

// Export for use in other modules
window.CryptoSealer = CryptoSealer;

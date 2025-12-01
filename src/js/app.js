/**
 * Verum Omnis Forensic Engine - Main Application
 * Implements the UI logic and orchestrates the analysis workflow
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize engines
    const rulesEngine = new RulesEngine();
    const cryptoSealer = new CryptoSealer();
    const narrativeGenerator = new NarrativeGenerator();

    // State
    let uploadedFiles = [];
    let currentAnalysisResults = null;
    let currentNarrative = null;
    let currentSealedPDF = null;

    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const evidenceText = document.getElementById('evidenceText');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const resultsSection = document.getElementById('resultsSection');
    const downloadBtn = document.getElementById('downloadBtn');

    // Options
    const contradictionEngine = document.getElementById('contradictionEngine');
    const fraudDetection = document.getElementById('fraudDetection');
    const timelineAnalysis = document.getElementById('timelineAnalysis');
    const dishonestyMatrix = document.getElementById('dishonestyMatrix');
    const hashType = document.getElementById('hashType');

    // Output elements
    const integrityHash = document.getElementById('integrityHash');
    const narrativeOutput = document.getElementById('narrativeOutput');
    const contradictionsOutput = document.getElementById('contradictionsOutput');
    const tagsOutput = document.getElementById('tagsOutput');
    const scoreBar = document.getElementById('scoreBar');
    const scoreValue = document.getElementById('scoreValue');

    // File Upload Handlers
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    function handleFiles(files) {
        for (const file of files) {
            if (!uploadedFiles.find(f => f.name === file.name)) {
                uploadedFiles.push(file);
            }
        }
        renderFileList();
    }

    function renderFileList() {
        fileList.innerHTML = '';
        for (const file of uploadedFiles) {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span>📄 ${file.name}</span>
                <button class="remove-btn" data-name="${file.name}">×</button>
            `;
            fileList.appendChild(fileItem);
        }

        // Add remove handlers
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const fileName = btn.dataset.name;
                uploadedFiles = uploadedFiles.filter(f => f.name !== fileName);
                renderFileList();
            });
        });
    }

    // Read file content
    async function readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsText(file);
            } else if (file.type === 'application/pdf') {
                // For PDFs, we'll just note that it was uploaded
                resolve(`[PDF Document: ${file.name}]`);
            } else if (file.type.startsWith('image/')) {
                resolve(`[Image: ${file.name}]`);
            } else {
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsText(file);
            }
        });
    }

    // Analyze Button Handler
    analyzeBtn.addEventListener('click', async () => {
        // Collect all text content
        let allText = evidenceText.value;

        // Read uploaded files
        for (const file of uploadedFiles) {
            try {
                const content = await readFileContent(file);
                allText += '\n\n' + content;
            } catch (error) {
                console.error('Error reading file:', file.name, error);
            }
        }

        if (!allText.trim()) {
            alert('Please enter evidence text or upload documents for analysis.');
            return;
        }

        // Show loading state
        analyzeBtn.classList.add('loading');
        analyzeBtn.textContent = 'Analyzing...';

        try {
            // Get options
            const options = {
                contradictionEngine: contradictionEngine.checked,
                fraudDetection: fraudDetection.checked,
                timelineAnalysis: timelineAnalysis.checked,
                dishonestyMatrix: dishonestyMatrix.checked,
                hashType: hashType.value
            };

            // Run analysis
            currentAnalysisResults = rulesEngine.analyze(allText, options);

            // Generate narrative
            currentNarrative = narrativeGenerator.generate(currentAnalysisResults, options);

            // Generate sealed PDF
            const pdfResult = await cryptoSealer.createSealedPDF(
                currentAnalysisResults, 
                currentNarrative, 
                options
            );
            currentSealedPDF = pdfResult.pdf;

            // Display results
            displayResults(currentAnalysisResults, currentNarrative, pdfResult.seal);

        } catch (error) {
            console.error('Analysis error:', error);
            alert('An error occurred during analysis. Please try again.');
        } finally {
            analyzeBtn.classList.remove('loading');
            analyzeBtn.textContent = '🔍 Analyze & Generate Sealed Report';
        }
    });

    function displayResults(results, narrative, seal) {
        // Show results section
        resultsSection.classList.remove('hidden');

        // Display integrity hash
        integrityHash.textContent = `${seal.algorithm}: ${seal.hash}`;

        // Display narrative
        narrativeOutput.textContent = narrative;

        // Display contradictions
        contradictionsOutput.innerHTML = '';
        if (results.contradictions && results.contradictions.length > 0) {
            for (const c of results.contradictions) {
                const item = document.createElement('div');
                item.className = 'contradiction-item';
                item.innerHTML = `
                    <strong>${c.type.toUpperCase()}</strong>: ${c.description}<br>
                    <small>Layer: ${c.layer} | Weight: ${c.weight}/3</small>
                `;
                contradictionsOutput.appendChild(item);
            }
        } else {
            contradictionsOutput.innerHTML = '<p>No contradictions detected.</p>';
        }

        // Display tags
        tagsOutput.innerHTML = '';
        if (results.tags && results.tags.length > 0) {
            for (const tag of results.tags) {
                const tagEl = document.createElement('span');
                tagEl.className = `tag ${tag.severity.toLowerCase()}`;
                tagEl.textContent = tag.name;
                tagsOutput.appendChild(tagEl);
            }
        } else {
            tagsOutput.innerHTML = '<p>No legal subject tags identified.</p>';
        }

        // Display score
        const score = results.dishonestyScore?.score || 0;
        scoreBar.style.width = `${score * 10}%`;
        scoreValue.textContent = `${score}/10`;

        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Download Button Handler
    downloadBtn.addEventListener('click', () => {
        if (currentSealedPDF) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            cryptoSealer.downloadPDF(currentSealedPDF, `verum-omnis-report-${timestamp}.pdf`);
        } else {
            alert('No report available. Please run analysis first.');
        }
    });

    // Load Verum Constitution on startup
    loadConstitution();

    async function loadConstitution() {
        try {
            const response = await fetch('verum-constitution.json');
            const constitution = await response.json();
            console.log('Verum Omnis Constitution loaded:', constitution.version);
            console.log('Engine:', constitution.engine);
            console.log('Core Principles:', Object.keys(constitution.core_principles).length);
        } catch (error) {
            console.log('Constitution file not loaded via fetch, using embedded rules.');
        }
    }
});

# Verum Omnis - Forensic Document Engine

**Cryptographically Sealed Reports & Evidence Analysis**

A web-based forensic document analysis engine implementing the Verum Omnis Constitutional Governance Framework with cryptographic PDF sealing capabilities.

## 🚀 Features

- 📄 **Document Upload** - Support for PDF, images, and text documents
- 🔍 **Forensic Analysis** - Automated contradiction detection and legal subject identification
- 🔐 **Cryptographic Sealing** - SHA-512/SHA-256 hash-based document integrity
- 📖 **Narrative Generation** - Human-readable forensic reports
- 🏷️ **Legal Tagging** - Automatic classification of legal subjects
- 📊 **Dishonesty Scoring** - Matrix-based analysis scoring
- 💾 **Stateless Operation** - No data persistence for privacy
- 📥 **PDF Export** - Download cryptographically sealed reports

## 🛠️ Technology

- **Frontend**: Pure HTML/CSS/JavaScript
- **PDF Generation**: Pure JavaScript implementation (no external dependencies)
- **Cryptography**: Web Crypto API (SHA-512, SHA-256)
- **Analysis Engine**: Custom rules-based engine

## 📁 Project Structure

```
verumweb/
├── index.html                          # Main application
├── verum-constitution.json             # Constitutional governance rules
├── src/
│   ├── css/
│   │   └── styles.css                  # Application styles
│   └── js/
│       ├── app.js                      # Main application logic
│       ├── rules-engine.js             # Verum Omnis rules engine
│       ├── crypto-sealer.js            # Cryptographic PDF sealing
│       └── narrative-generator.js      # Report narrative generation
├── assets/
│   └── rules/
│       ├── dishonesty_matrix.json      # Dishonesty detection patterns
│       ├── extraction_protocol.json    # Extraction rules
│       └── legal_subjects.json         # Legal subject definitions
└── *.PDF                               # Logic documentation
```

## 🚀 Quick Start

1. **Clone the repository**
```bash
git clone https://github.com/Liamhigh/verumweb.git
cd verumweb
```

2. **Serve the application**
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .

# Or simply open index.html in a browser
```

3. **Open in browser**
```
http://localhost:8000
```

## 📋 How to Use

1. **Upload Documents** - Drag and drop or click to upload evidence documents
2. **Enter Text** - Optionally paste text for analysis
3. **Configure Options** - Select analysis options (contradiction detection, fraud patterns, etc.)
4. **Analyze** - Click "Analyze & Generate Sealed Report"
5. **Review Results** - View contradictions, legal tags, and dishonesty score
6. **Download PDF** - Get cryptographically sealed PDF report

## 🔐 Cryptographic Sealing

All generated reports include:
- **SHA-512 Hash** - Document integrity verification
- **Timestamp** - Immutable creation time
- **Watermark** - "VERUM OMNIS FORENSIC SEAL"
- **Footer Seal** - Hash embedded in every page

## 📜 Constitutional Governance

This engine operates under the Verum Omnis Constitutional Governance Layer:

- **Truth First** - Factual accuracy and verifiable evidence
- **Fairness** - Protect vulnerable parties
- **Human Rights** - Uphold dignity and equality
- **Non-Extraction** - No sensitive data transmission
- **Independence** - Unbiased analysis

## 👤 Creator

**Liam Highcock** - Verum Global Foundation

## 📄 License

This project operates under the Verum Omnis Constitutional Governance framework.

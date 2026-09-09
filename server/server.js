const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const XLSX = require('xlsx');
const { execFile } = require('child_process');
const { promisify } = require('util');
const nodemailer = require('nodemailer');

const {
    getDatabase,
    createUser,
    findUserByLoginCode,
    validatePassword,
    getAllUsers,
    deleteUser,
    updateUserRole,
    findUserById,
    updateUserProfile,
    updateUserPassword,
    appendToExcel
} = require('./database');

const execFileAsync = promisify(execFile);

const pythonCommand =
    process.env.VALEO_PYTHON ||
    (process.platform === 'win32' ? 'python' : 'python3');

const app = express();
const PORT = 3000;

const capturesDirectory =
    path.join(__dirname, 'captures');

const HISTORY_FILE =
    path.join(__dirname, 'history.json');

const XML_DIRECTORY =
    process.env.VALEO_XML_DIRECTORY ||
    path.join(__dirname, 'xml');

const XML_SCHEMA_PATH =
    process.env.VALEO_XML_SCHEMA_PATH ||
    (
        process.platform === 'win32'
            ? 'C:/Inetpub/wwwroot/SchemaRepository/XMLSchemas/FlexNet/FSA_INT_FlatFileManager.xsd'
            : '/var/www/html/SchemaRepository/XMLSchemas/FlexNet/FSA_INT_FlatFileManager.xsd'
    );

const BASE_DATA_PATH =
    process.env.VALEO_BASE_DATA_PATH ||
    path.join(
        process.env.USERPROFILE ||
        process.env.HOME ||
        '',
        'Downloads',
        'BASE DONNEES (1).xlsx'
    );

function escapeXml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function formatXmlDateTime(value) {
    const date = value ? new Date(value) : new Date();

    if (Number.isNaN(date.getTime())) {
        return formatXmlDateTime(new Date());
    }

    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();

    let hours = date.getHours();

    const minutes =
        String(date.getMinutes()).padStart(2, '0');

    const ampm =
        hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12 || 12;

    return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
}

function buildProductionXml(
    productNo,
    eventDateTime,
    quantityTotal
) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<FSA_INT_FlatFileManager
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:noNamespaceSchemaLocation="${XML_SCHEMA_PATH}"
    Version="1.0">
<FIInvocationSynchronousEvent NodeType="FIInvocation">
<StandardOperation>
<OperationResolutionMethod>ByOperationCode</OperationResolutionMethod>
<OperationCode>SVC_MES_MI_ProductionDeclaration</OperationCode>
</StandardOperation>
<Parameters>
<Inputs>
<InputName>WorkCenter</InputName>
<InputValue>EC002000</InputValue>
</Inputs>
<Inputs>
<InputName>ProductNo</InputName>
<InputValue>${escapeXml(productNo)}</InputValue>
</Inputs>
<Inputs>
<InputName>EventDateTime</InputName>
<InputValue>${escapeXml(eventDateTime)}</InputValue>
</Inputs>
<Inputs>
<InputName>SerialNo</InputName>
<InputValue>AAAA</InputValue>
</Inputs>
<Inputs>
<InputName>Quantity</InputName>
<InputValue>${escapeXml(quantityTotal)}</InputValue>
</Inputs>
<Inputs>
<InputName>CycleTime</InputName>
<InputValue>245</InputValue>
</Inputs>
</Parameters>
</FIInvocationSynchronousEvent>
</FSA_INT_FlatFileManager>`;
}

app.use(cors());

app.use(
    express.json({
        limit: '10mb'
    })
);

app.use(
    express.static(
        path.join(__dirname, '..')
    )
);

function normalizeHeader(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeNumeric(value) {
    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return 0;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value)
            ? value
            : 0;
    }

    const cleaned =
        String(value)
            .replace(/[^0-9.,-]/g, '')
            .replace(',', '.');

    const parsed = Number(cleaned);

    return Number.isFinite(parsed)
        ? parsed
        : 0;
}

function readBaseDonneesFromExcel(filePath) {
    if (
        !filePath ||
        !fsSync.existsSync(filePath)
    ) {
        return [];
    }

    const workbook =
        XLSX.readFile(filePath);

    const sheetName =
        workbook.SheetNames.find(
            name => /table/i.test(name)
        );

    const targetSheet =
        workbook.Sheets['Table'] ||
        (
            sheetName
                ? workbook.Sheets[sheetName]
                : null
        );

    if (!targetSheet) {
        return [];
    }

    const rowsArray =
        XLSX.utils.sheet_to_json(
            targetSheet,
            {
                header: 1,
                defval: '',
                raw: false
            }
        );

    if (
        !rowsArray ||
        rowsArray.length < 3
    ) {
        return [];
    }

    const rows = [];
    const seen = new Set();

    rowsArray
        .slice(2)
        .forEach(row => {
            if (!Array.isArray(row)) {
                return;
            }

            const family =
                String(row[1] || '').trim();

            const product =
                String(row[2] || '').trim();

            const totalValue =
                row[5] ??
                row[4] ??
                row[6] ??
                0;

            const quantite =
                normalizeNumeric(totalValue);

            const jigsTotales =
                normalizeNumeric(
                    row[4] || 0
                );

            if (
                !product &&
                !family
            ) {
                return;
            }

            if (!(quantite > 0)) {
                return;
            }

            const aliases = new Set();

            if (product) {
                aliases.add(product);
            }

            if (
                family &&
                product
            ) {
                aliases.add(
                    `${family} ${product}`
                );

                aliases.add(
                    `${family}_${product}`
                );
            }

            if (
                family &&
                !product
            ) {
                aliases.add(family);
            }

            aliases.forEach(alias => {
                const cleanAlias =
                    String(alias).trim();

                if (!cleanAlias) {
                    return;
                }

                const key =
                    `Table|${cleanAlias}`;

                if (seen.has(key)) {
                    return;
                }

                seen.add(key);

                const numericQuantity =
                    Number(quantite) || 0;

                rows.push({
                    id:
                        `EXCEL-${rows.length + 1}`,

                    date:
                        new Date()
                            .toLocaleDateString(
                                'fr-FR'
                            ),

                    heure:
                        new Date()
                            .toLocaleTimeString(
                                'fr-FR'
                            ),

                    produit:
                        cleanAlias,

                    quantite:
                        numericQuantity,

                    quantite_totale:
                        numericQuantity,

                    jigs_totales:
                        Number(jigsTotales) || 0,

                    taux:
                        `${Math.min(
                            100,
                            Math.max(
                                0,
                                numericQuantity
                            )
                        )}%`,

                    jigs:
                        normalizeNumeric(
                            row[3] || 0
                        ),

                    kits:
                        normalizeNumeric(
                            row[4] || 0
                        ),

                    consommation:
                        normalizeNumeric(
                            row[6] || 0
                        ),

                    sheet:
                        'Table'
                });
            });
        });

    return rows;
}

async function readHistoryFile() {
    try {
        const raw =
            await fs.readFile(
                HISTORY_FILE,
                'utf8'
            );

        const parsed =
            JSON.parse(raw);

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }

        console.error(
            'Erreur lecture historique:',
            error.message
        );

        return [];
    }
}

async function writeHistoryFile(history) {
    await fs.writeFile(
        HISTORY_FILE,
        JSON.stringify(
            history,
            null,
            2
        ),
        'utf8'
    );
}

function findProductReference(product) {
    const target =
        String(product || '')
            .trim()
            .toLowerCase();

    if (!target) {
        return null;
    }

    try {
        const rows =
            readBaseDonneesFromExcel(
                BASE_DATA_PATH
            );

        return (
            rows.find(row =>
                String(
                    row.produit || ''
                )
                    .trim()
                    .toLowerCase() === target
            ) ||

            rows.find(row => {
                const current =
                    String(
                        row.produit || ''
                    )
                        .trim()
                        .toLowerCase();

                return (
                    current.includes(target) ||
                    target.includes(current)
                );
            }) ||

            null
        );

    } catch (error) {
        console.error(
            'Erreur recherche référence produit:',
            error.message
        );

        return null;
    }
}

async function saveDetectionEvents(
    counts,
    jigCount = 0,
    dashboardRendement = null
) {
    if (
        !counts ||
        typeof counts !== 'object'
    ) {
        return [];
    }

    const validProducts =
        Object.entries(counts)
            .map(
                ([product, quantity]) => ({
                    product:
                        String(
                            product || ''
                        ).trim(),

                    quantity:
                        normalizeNumeric(
                            quantity
                        )
                })
            )
            .filter(item =>
                item.product &&
                item.quantity > 0
            );

    if (!validProducts.length) {
        return [];
    }

    const history =
        await readHistoryFile();

    const saved = [];

    const now = new Date();

    const jigsDetectees =
        normalizeNumeric(
            jigCount
        );

    let rendementDashboard = null;

    if (
        dashboardRendement !== null &&
        dashboardRendement !== undefined &&
        dashboardRendement !== ''
    ) {
        rendementDashboard =
            normalizeNumeric(
                dashboardRendement
            );
    }

    for (const item of validProducts) {

        const reference =
            findProductReference(
                item.product
            ) || {};

        const jigsTotal =
            Number(
                reference.jigs_totales ||
                reference.jigs ||
                0
            ) || 0;

        const family =
            reference.famille ||
            '—';

        const previousTotal =
            history
                .filter(record =>
                    String(
                        record.produit || ''
                    )
                        .trim()
                        .toLowerCase() ===
                    item.product
                        .toLowerCase()
                )
                .reduce(
                    (
                        sum,
                        record
                    ) =>
                        sum +
                        normalizeNumeric(
                            record.quantite
                        ),
                    0
                );

        const totalLoading =
            previousTotal +
            item.quantity;

        let rendement;

        if (
            rendementDashboard !== null
        ) {
            rendement =
                Math.min(
                    100,
                    Math.max(
                        0,
                        rendementDashboard
                    )
                );
        } else {
            rendement =
                jigsTotal > 0
                    ? Math.min(
                        100,
                        Math.round(
                            (
                                item.quantity /
                                jigsTotal
                            ) * 100
                        )
                    )
                    : 0;
        }

        const record = {
            id:
                `VAL-${now.getTime()}-${Math.random()
                    .toString(36)
                    .slice(2, 8)
                    .toUpperCase()}`,

            date:
                now.toLocaleDateString(
                    'fr-FR'
                ),

            heure:
                now.toLocaleTimeString(
                    'fr-FR'
                ),

            timestamp:
                now.toISOString(),

            produit:
                item.product,

            famille:
                family,

            quantite:
                item.quantity,

            quantite_totale:
                totalLoading,

            chargement_total:
                jigsDetectees,

            jigs_detectees:
                jigsDetectees,

            jigs_totales:
                jigsTotal,

            rendement:
                rendement,

            taux:
                `${rendement}%`
        };

        history.unshift(record);

        saved.push(record);
    }

    await writeHistoryFile(
        history.slice(
            0,
            10000
        )
    );

    return saved;
}

app.get(
    '/api/history',
    async (req, res) => {
        try {
            const history =
                await readHistoryFile();

            res.json({
                success: true,
                history
            });

        } catch (error) {
            console.error(
                'Erreur API historique:',
                error.message
            );

            res.status(500).json({
                success: false,
                message:
                    'Impossible de charger l\'historique.',
                history: []
            });
        }
    }
);

app.post(
    '/api/history',
    async (req, res) => {
        try {
            const record =
                req.body;

            if (
                !record ||
                !record.produit
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Produit requis.'
                });
            }

            const history =
                await readHistoryFile();

            const jigsDetectees =
                normalizeNumeric(
                    record.jigs_detectees ??
                    record.jigsDetectees ??
                    record.jig_count ??
                    record.jigCount ??
                    record.jigs ??
                    0
                );

            const rendement =
                normalizeNumeric(
                    record.rendement ??
                    record.taux ??
                    record.yield ??
                    0
                );

            const newRecord = {
                id:
                    `VAL-${Date.now()}-${Math.random()
                        .toString(36)
                        .slice(2, 8)
                        .toUpperCase()}`,

                date:
                    new Date()
                        .toLocaleDateString(
                            'fr-FR'
                        ),

                heure:
                    new Date()
                        .toLocaleTimeString(
                            'fr-FR'
                        ),

                timestamp:
                    new Date().toISOString(),

                produit:
                    String(
                        record.produit || ''
                    ).trim(),

                famille:
                    record.famille ||
                    '—',

                quantite:
                    normalizeNumeric(
                        record.quantite
                    ),

                quantite_totale:
                    normalizeNumeric(
                        record.quantite_totale ??
                        record.quantite
                    ),

                chargement_total:
                    jigsDetectees,

                jigs_detectees:
                    jigsDetectees,

                jigs_totales:
                    normalizeNumeric(
                        record.jigs_totales
                    ),

                rendement:
                    rendement,

                taux:
                    record.taux ||
                    `${rendement}%`
            };

            history.unshift(
                newRecord
            );

            await writeHistoryFile(
                history.slice(
                    0,
                    10000
                )
            );

            res.json({
                success: true,
                record: newRecord
            });

        } catch (error) {
            console.error(
                'Erreur API historique POST:',
                error.message
            );

            res.status(500).json({
                success: false,
                message:
                    'Impossible de sauvegarder dans l\'historique.'
            });
        }
    }
);

app.get(
    '/api/base-donnees',
    (req, res) => {
        try {
            const rows =
                readBaseDonneesFromExcel(
                    BASE_DATA_PATH
                );

            res.json({
                success: true,
                source:
                    BASE_DATA_PATH,
                count:
                    rows.length,
                data:
                    rows
            });

        } catch (error) {
            console.error(
                'Erreur lecture Excel serveur:',
                error.message
            );

            res.status(500).json({
                success: false,
                message:
                    'Impossible de lire la base Excel côté serveur.',
                data: []
            });
        }
    }
);

app.get(
    '/api/detect-test',
    (req, res) => {
        try {
            const rows =
                readBaseDonneesFromExcel(
                    BASE_DATA_PATH
                );

            const testProduct =
                rows.length > 0
                    ? rows[0].produit
                    : 'PRODUIT_TEST';

            res.json({
                success: true,
                capture:
                    'test-capture.jpg',

                detections: [
                    {
                        product:
                            testProduct,

                        confidence:
                            0.95,

                        x: null,
                        y: null,
                        width: null,
                        height: null,

                        model:
                            'primary'
                    }
                ],

                counts: {
                    [testProduct]: 1
                },

                jig_detections: [],

                jig_count:
                    0,

                jig_counts: {},

                test:
                    true
            });

        } catch (error) {
            console.error(
                'Test detection error:',
                error.message
            );

            res.json({
                success: true,
                capture:
                    'test-capture.jpg',

                detections: [
                    {
                        product:
                            'PRODUIT_TEST',

                        confidence:
                            0.95,

                        x: null,
                        y: null,
                        width: null,
                        height: null,

                        model:
                            'primary'
                    }
                ],

                counts: {
                    PRODUIT_TEST: 1
                },

                jig_detections: [],

                jig_count:
                    0,

                jig_counts: {},

                test:
                    true
            });
        }
    }
);

/*
 * ============================================================
 * COGNEX
 * ============================================================
 *
 * Seule cette partie a été corrigée.
 *
 * Le script cognex_camera.py :
 * - se connecte à la caméra
 * - capture l'image
 * - retourne le JSON dans stdout
 *
 * Les logs Python sont dans stderr.
 */

let cognexLatestFrame = null;
let cognexCaptureRunning = false;
let cognexCaptureLoopStarted = false;
let cognexLastCaptureError = null;

async function executeCognexCapture() {
    if (cognexCaptureRunning) {
        return cognexLatestFrame;
    }

    cognexCaptureRunning = true;

    try {
        const cognexScript =
            path.join(__dirname, 'cognex_camera.py');

        if (!fsSync.existsSync(cognexScript)) {
            throw new Error(
                `cognex_camera.py introuvable : ${cognexScript}`
            );
        }

        const result =
            await execFileAsync(
                pythonCommand,
                [cognexScript],
                {
                    cwd: __dirname,
                    timeout: 15000,
                    maxBuffer: 50 * 1024 * 1024,
                    windowsHide: true,
                    env: process.env
                }
            );

        const stdout =
            String(result.stdout || '').trim();

        const stderr =
            String(result.stderr || '').trim();

        if (stderr) {
            console.log('[COGNEX]', stderr);
        }

        if (!stdout) {
            throw new Error(
                'cognex_camera.py n\'a retourné aucun résultat.'
            );
        }

        const lines =
            stdout
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(Boolean);

        let cognexResult = null;

        for (let i = lines.length - 1; i >= 0; i--) {
            try {
                const parsed = JSON.parse(lines[i]);

                if (
                    parsed &&
                    typeof parsed === 'object'
                ) {
                    cognexResult = parsed;
                    break;
                }
            } catch (_) {}
        }

        if (!cognexResult) {
            throw new Error(
                'Impossible de lire la réponse JSON de cognex_camera.py.'
            );
        }

        if (cognexResult.success !== true) {
            throw new Error(
                cognexResult.error ||
                'Capture Cognex échouée.'
            );
        }

        if (
            !cognexResult.image ||
            typeof cognexResult.image !== 'string'
        ) {
            throw new Error(
                'La caméra Cognex a répondu mais aucune image n\'a été reçue.'
            );
        }

        cognexLatestFrame = {
            success: true,
            image: cognexResult.image,
            width: Number(cognexResult.width) || 640,
            height: Number(cognexResult.height) || 480,
            timestamp: Date.now()
        };

        cognexLastCaptureError = null;

        return cognexLatestFrame;

    } catch (error) {
        cognexLastCaptureError = error;

        console.error(
            '[COGNEX] Erreur :',
            error.message
        );

        if (error.stdout) {
            console.error(
                '[COGNEX] STDOUT:',
                error.stdout
            );
        }

        if (error.stderr) {
            console.error(
                '[COGNEX] STDERR:',
                error.stderr
            );
        }

        return cognexLatestFrame;

    } finally {
        cognexCaptureRunning = false;
    }
}

function startCognexCaptureLoop() {
    if (cognexCaptureLoopStarted) {
        return;
    }

    cognexCaptureLoopStarted = true;

    executeCognexCapture().catch(() => {});

    setInterval(() => {
        if (!cognexCaptureRunning) {
            executeCognexCapture().catch(() => {});
        }
    }, 150);
}

app.post(
    '/api/cognex/capture',
    async (req, res) => {
        try {
            startCognexCaptureLoop();

            if (cognexLatestFrame) {
                return res.status(200).json({
                    success: true,
                    image: cognexLatestFrame.image,
                    width: cognexLatestFrame.width,
                    height: cognexLatestFrame.height,
                    timestamp: cognexLatestFrame.timestamp,
                    stream: true
                });
            }

            const frame =
                await executeCognexCapture();

            if (!frame) {
                return res.status(500).json({
                    success: false,
                    error:
                        cognexLastCaptureError?.message ||
                        'Aucune image Cognex disponible.'
                });
            }

            return res.status(200).json({
                success: true,
                image: frame.image,
                width: frame.width,
                height: frame.height,
                timestamp: frame.timestamp,
                stream: true
            });

        } catch (error) {
            console.error(
                '[COGNEX] Erreur endpoint :',
                error.message
            );

            return res.status(500).json({
                success: false,
                error:
                    error.message ||
                    'Erreur de communication avec la caméra Cognex.'
            });
        }
    }
);

app.get(
    '/api/cognex/frame',
    async (req, res) => {
        try {
            startCognexCaptureLoop();

            if (!cognexLatestFrame) {
                const frame =
                    await executeCognexCapture();

                if (!frame) {
                    return res.status(503).json({
                        success: false,
                        error:
                            cognexLastCaptureError?.message ||
                            'Image Cognex indisponible.'
                    });
                }
            }

            return res.status(200).json({
                success: true,
                image: cognexLatestFrame.image,
                width: cognexLatestFrame.width,
                height: cognexLatestFrame.height,
                timestamp: cognexLatestFrame.timestamp
            });

        } catch (error) {
            return res.status(500).json({
                success: false,
                error:
                    error.message ||
                    'Erreur de lecture du flux Cognex.'
            });
        }
    }
);

app.post(
    '/api/detect',
    async (req, res) => {
        const image =
            req.body?.image;

        if (
            !image ||
            typeof image !== 'string'
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Image manquante.'
            });
        }

        const base64 =
            image.replace(
                /^data:image\/[a-zA-Z0-9+.-]+;base64,/,
                ''
            );

        let imagePath;

        try {
            const imageBuffer =
                Buffer.from(
                    base64,
                    'base64'
                );

            if (
                !imageBuffer.length ||
                imageBuffer.length >
                8 * 1024 * 1024
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Image invalide ou trop volumineuse.'
                });
            }

            await fs.mkdir(
                capturesDirectory,
                {
                    recursive: true
                }
            );

            const captureName =
                `capture-${new Date()
                    .toISOString()
                    .replace(/[:.]/g, '-')}-${Math.random()
                    .toString(36)
                    .slice(2, 8)}.jpg`;

            imagePath =
                path.join(
                    capturesDirectory,
                    captureName
                );

            await fs.writeFile(
                imagePath,
                imageBuffer,
                {
                    mode: 0o600
                }
            );

            const scriptPath =
                path.join(
                    __dirname,
                    'inference.py'
                );

            if (
                !fsSync.existsSync(
                    scriptPath
                )
            ) {
                return res.status(500).json({
                    success: false,
                    message:
                        `inference.py introuvable : ${scriptPath}`
                });
            }

            try {
                const {
                    stdout,
                    stderr
                } =
                    await execFileAsync(
                        pythonCommand,
                        [
                            scriptPath,
                            imagePath
                        ],
                        {
                            timeout:
                                120000,

                            maxBuffer:
                                4 * 1024 * 1024,

                            env:
                                process.env
                        }
                    );

                if (stderr) {
                    console.log(
                        '[PYTHON]',
                        stderr
                    );
                }

                const output =
                    String(stdout || '')
                        .trim();

                if (!output) {
                    throw new Error(
                        'inference.py n\'a retourné aucun résultat JSON.'
                    );
                }

                const lines =
                    output
                        .split(/\r?\n/)
                        .map(
                            line =>
                                line.trim()
                        )
                        .filter(Boolean);

                let inference = null;

                for (
                    let i = lines.length - 1;
                    i >= 0;
                    i--
                ) {
                    try {
                        const parsed =
                            JSON.parse(
                                lines[i]
                            );

                        if (
                            parsed &&
                            typeof parsed === 'object'
                        ) {
                            inference =
                                parsed;

                            break;
                        }

                    } catch (_) {}
                }

                if (!inference) {
                    throw new Error(
                        'Impossible de lire le JSON retourné par inference.py.'
                    );
                }

                const savedHistory =
                    await saveDetectionEvents(
                        inference.counts,
                        inference.jig_count ??
                        inference.jigCount ??
                        0,
                        inference.rendement ??
                        inference.yield ??
                        inference.taux ??
                        null
                    );

                return res.json({
                    success: true,

                    capture:
                        captureName,

                    ...inference,

                    historySaved:
                        savedHistory.length > 0,

                    historyRecords:
                        savedHistory
                });

            } catch (inferenceError) {
                console.error(
                    'Erreur inference.py:',
                    inferenceError.message
                );

                if (
                    inferenceError.stdout
                ) {
                    console.error(
                        'stdout:',
                        inferenceError.stdout
                    );
                }

                if (
                    inferenceError.stderr
                ) {
                    console.error(
                        'stderr:',
                        inferenceError.stderr
                    );
                }

                return res.status(500).json({
                    success: false,

                    capture:
                        captureName,

                    detections: [],

                    counts: {},

                    jig_detections: [],

                    jig_count: 0,

                    jig_counts: {},

                    message:
                        `Erreur lors de l'exécution des modèles IA : ${inferenceError.message}`
                });
            }

        } catch (error) {
            console.error(
                'Inference error:',
                error.message
            );

            return res.status(500).json({
                success: false,

                capture:
                    'unknown',

                detections: [],

                counts: {},

                jig_detections: [],

                jig_count: 0,

                jig_counts: {},

                message:
                    'Erreur serveur lors du traitement de l\'image.'
            });
        }
    }
);

app.post(
    '/api/signup',
    (req, res) => {
        try {
            const {
                firstName,
                lastName,
                email,
                role,
                password
            } = req.body;

            if (
                !firstName ||
                !lastName ||
                !email ||
                !role ||
                !password
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Tous les champs sont requis.'
                });
            }

            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (
                !emailPattern.test(email)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Format d\'email invalide.'
                });
            }

            const validRoles = [
                'Ingénieur',
                'Technicien',
                'Ouvrier'
            ];

            if (
                !validRoles.includes(role)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Rôle invalide. Choisissez Ingénieur, Technicien ou Ouvrier.'
                });
            }

            if (
                password.length < 8
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Le mot de passe doit contenir au moins 8 caractères.'
                });
            }

            const {
                userId,
                loginCode
            } =
                createUser(
                    firstName,
                    lastName,
                    email,
                    role,
                    password
                );

            try {
                appendToExcel(
                    firstName,
                    lastName,
                    email,
                    role,
                    loginCode,
                    password,
                    userId
                );
            } catch (excelErr) {
                console.error(
                    'Erreur écriture Excel:',
                    excelErr.message
                );
            }

            res.status(201).json({
                success: true,

                message:
                    'Compte créé avec succès.',

                loginCode,

                userId
            });

        } catch (error) {
            console.error(
                'Signup error:',
                error
            );

            res.status(500).json({
                success: false,
                message:
                    'Erreur serveur. Veuillez réessayer.'
            });
        }
    }
);

app.post(
    '/api/login',
    (req, res) => {
        try {
            const {
                loginCode,
                password
            } = req.body;

            if (
                !loginCode ||
                !password
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Code et mot de passe requis.'
                });
            }

            const user =
                findUserByLoginCode(
                    loginCode.toUpperCase()
                );

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message:
                        'Code ou mot de passe incorrect.'
                });
            }

            if (
                !validatePassword(
                    password,
                    user.password_hash
                )
            ) {
                return res.status(401).json({
                    success: false,
                    message:
                        'Code ou mot de passe incorrect.'
                });
            }

            res.json({
                success: true,

                message:
                    'Connexion réussie.',

                user: {
                    id:
                        user.id,

                    firstName:
                        user.first_name,

                    lastName:
                        user.last_name,

                    email:
                        user.email || '',

                    role:
                        user.role,

                    loginCode:
                        user.login_code,

                    isAdmin:
                        user.is_admin === 1
                }
            });

        } catch (error) {
            console.error(
                'Login error:',
                error
            );

            res.status(500).json({
                success: false,
                message:
                    'Erreur serveur. Veuillez réessayer.'
            });
        }
    }
);

app.get(
    '/api/users',
    (req, res) => {
        try {
            const users =
                getAllUsers();

            res.json({
                success: true,
                users
            });

        } catch (error) {
            console.error(
                'Get users error:',
                error
            );

            res.status(500).json({
                success: false,
                message:
                    'Erreur serveur.'
            });
        }
    }
);

app.delete(
    '/api/users/:id',
    (req, res) => {
        try {
            const userId =
                parseInt(
                    req.params.id,
                    10
                );

            if (isNaN(userId)) {
                return res.status(400).json({
                    success: false,
                    message:
                        'ID invalide.'
                });
            }

            deleteUser(userId);

            res.json({
                success: true,
                message:
                    'Utilisateur supprimé.'
            });

        } catch (error) {
            console.error(
                'Delete user error:',
                error
            );

            res.status(500).json({
                success: false,
                message:
                    'Erreur serveur.'
            });
        }
    }
);

app.put(
    '/api/users/:id/role',
    (req, res) => {
        try {
            const userId =
                parseInt(
                    req.params.id,
                    10
                );

            const {
                role
            } = req.body;

            const validRoles = [
                'Ingénieur',
                'Technicien',
                'Ouvrier'
            ];

            if (
                !validRoles.includes(role)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Rôle invalide.'
                });
            }

            updateUserRole(
                userId,
                role
            );

            res.json({
                success: true,
                message:
                    'Rôle mis à jour.'
            });

        } catch (error) {
            console.error(
                'Update role error:',
                error
            );

            res.status(500).json({
                success: false,
                message:
                    'Erreur serveur.'
            });
        }
    }
);

app.get(
    '/api/users/:id',
    (req, res) => {
        try {
            const userId =
                parseInt(
                    req.params.id,
                    10
                );

            if (isNaN(userId)) {
                return res.status(400).json({
                    success: false,
                    message:
                        'ID invalide.'
                });
            }

            const user =
                findUserById(userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message:
                        'Utilisateur introuvable.'
                });
            }

            res.json({
                success: true,

                user: {
                    id:
                        user.id,

                    firstName:
                        user.first_name,

                    lastName:
                        user.last_name,

                    email:
                        user.email,

                    role:
                        user.role,

                    loginCode:
                        user.login_code,

                    isAdmin:
                        user.is_admin === 1
                }
            });

        } catch (error) {
            console.error(
                'Get user error:',
                error
            );

            res.status(500).json({
                success: false,
                message:
                    'Erreur serveur.'
            });
        }
    }
);

app.put(
    '/api/users/change-password',
    (req, res) => {
        try {
            const {
                userId,
                currentPassword,
                newPassword
            } = req.body;

            if (
                !userId ||
                !currentPassword ||
                !newPassword
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Tous les champs sont requis.'
                });
            }

            if (
                newPassword.length < 8
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Le nouveau mot de passe doit contenir au moins 8 caractères.'
                });
            }

            const user =
                findUserById(
                    parseInt(
                        userId,
                        10
                    )
                );

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message:
                        'Utilisateur introuvable.'
                });
            }

            if (
                !validatePassword(
                    currentPassword,
                    user.password_hash
                )
            ) {
                return res.status(401).json({
                    success: false,
                    message:
                        'Mot de passe actuel incorrect.'
                });
            }

            const bcrypt =
                require('bcryptjs');

            const newHash =
                bcrypt.hashSync(
                    newPassword,
                    10
                );

            updateUserPassword(
                parseInt(
                    userId,
                    10
                ),
                newHash
            );

            res.json({
                success: true,
                message:
                    'Mot de passe modifié avec succès.'
            });

        } catch (error) {
            console.error(
                'Change password error:',
                error
            );

            res.status(500).json({
                success: false,
                message:
                    'Erreur serveur.'
            });
        }
    }
);

app.put(
    '/api/users/profile',
    (req, res) => {
        try {
            const {
                id,
                firstName,
                lastName,
                email,
                role
            } = req.body;

            if (
                !id ||
                !firstName ||
                !lastName ||
                !email ||
                !role
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Tous les champs sont requis.'
                });
            }

            const validRoles = [
                'Ingénieur',
                'Technicien',
                'Ouvrier'
            ];

            if (
                !validRoles.includes(role)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Rôle invalide.'
                });
            }

            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (
                !emailPattern.test(email)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Format d\'email invalide.'
                });
            }

            updateUserProfile(
                id,
                firstName,
                lastName,
                email,
                role
            );

            res.json({
                success: true,
                message:
                    'Profil mis à jour avec succès.'
            });

        } catch (error) {
            console.error(
                'Update profile error:',
                error
            );

            res.status(500).json({
                success: false,
                message:
                    'Erreur serveur.'
            });
        }
    }
);

app.post(
    '/api/alert-empty-balancelles',
    async (req, res) => {
        try {
            const {
                produit,
                quantite,
                rendement,
                timestamp
            } = req.body || {};

            const transporter =
                nodemailer.createTransport({
                    service: 'gmail',

                    auth: {
                        user:
                            process.env.VALEO_ALERT_EMAIL,

                        pass:
                            process.env.VALEO_ALERT_PASSWORD
                    }
                });

            const mailOptions = {
                from:
                    process.env.VALEO_ALERT_EMAIL ||
                    'alerte@valeo.local',

                to:
                    'sameher.ajimi@enis.tn',

                subject:
                    `Alerte Valeo : Rendement ${rendement ?? '?'}% < 90% - ${produit || 'Produit inconnu'}`,

                text:
                    `Alerte automatique Valeo.

Produit : ${produit || 'N/A'}

Dernière quantité : ${quantite ?? 0}

Rendement : ${rendement ?? '?'}%

Heure : ${timestamp || new Date().toLocaleString('fr-FR')}

Le rendement est inférieur à 90%.`,

                html:
                    `<p>Alerte automatique <strong>Valeo</strong>.</p>
<ul>
<li><strong>Produit :</strong> ${escapeXml(produit || 'N/A')}</li>
<li><strong>Dernière quantité :</strong> ${escapeXml(quantite ?? 0)}</li>
<li><strong>Rendement :</strong> ${escapeXml(rendement ?? '?')}%</li>
<li><strong>Heure :</strong> ${escapeXml(timestamp || new Date().toLocaleString('fr-FR'))}</li>
</ul>
<p>Le rendement est inférieur à 90%.</p>`
            };

            await transporter.sendMail(
                mailOptions
            );

            res.json({
                success: true,
                message:
                    'Alerte email envoyée.'
            });

        } catch (error) {
            console.error(
                'Erreur envoi alerte email:',
                error
            );

            res.status(500).json({
                success: false,
                message:
                    'Impossible d\'envoyer l\'alerte email.'
            });
        }
    }
);

app.post(
    '/api/generate-xml',
    async (req, res) => {
        try {
            const {
                ProductNo,
                EventDateTime,
                Quantity
            } = req.body || {};

            if (
                ProductNo === undefined ||
                ProductNo === null ||
                String(ProductNo).trim() === ''
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        'ProductNo est requis.'
                });
            }

            const quantityTotal =
                normalizeNumeric(
                    Quantity
                );

            if (
                !Number.isFinite(
                    quantityTotal
                ) ||
                quantityTotal < 0
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        'Quantity est invalide.'
                });
            }

            const formattedDateTime =
                formatXmlDateTime(
                    EventDateTime
                );

            await fs.mkdir(
                XML_DIRECTORY,
                {
                    recursive: true
                }
            );

            const now = new Date();

            const datePart = [
                now.getFullYear(),

                String(
                    now.getMonth() + 1
                ).padStart(
                    2,
                    '0'
                ),

                String(
                    now.getDate()
                ).padStart(
                    2,
                    '0'
                )
            ].join('');

            const timePart = [
                String(
                    now.getHours()
                ).padStart(
                    2,
                    '0'
                ),

                String(
                    now.getMinutes()
                ).padStart(
                    2,
                    '0'
                ),

                String(
                    now.getSeconds()
                ).padStart(
                    2,
                    '0'
                )
            ].join('');

            const randomPart =
                Math.random()
                    .toString(36)
                    .substring(
                        2,
                        8
                    )
                    .toUpperCase();

            const safeProductName =
                String(ProductNo)
                    .trim()
                    .replace(
                        /[<>:"/\\|?*\x00-\x1F]/g,
                        '_'
                    )
                    .replace(
                        /\s+/g,
                        '_'
                    );

            const filename =
                `Production_${safeProductName}_${datePart}_${timePart}_${randomPart}.xml`;

            const filePath =
                path.join(
                    XML_DIRECTORY,
                    filename
                );

            const xmlContent =
                buildProductionXml(
                    String(
                        ProductNo
                    ).trim(),

                    formattedDateTime,

                    quantityTotal
                );

            await fs.writeFile(
                filePath,
                xmlContent,
                'utf8'
            );

            console.log(
                'XML production généré :',
                filePath
            );

            res.json({
                success: true,

                message:
                    'Fichier XML généré avec succès.',

                filename,

                path:
                    filePath,

                data: {
                    ProductNo:
                        String(
                            ProductNo
                        ).trim(),

                    EventDateTime:
                        formattedDateTime,

                    Quantity:
                        quantityTotal
                }
            });

        } catch (error) {
            console.error(
                'Erreur génération XML :',
                error
            );

            res.status(500).json({
                success: false,
                error:
                    'Impossible de générer le fichier XML.'
            });
        }
    }
);

app.get(
    '*',
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                '..',
                'loading.html'
            )
        );
    }
);

async function startServer() {
    try {
        await fs.mkdir(
            XML_DIRECTORY,
            {
                recursive: true
            }
        );

        console.log(
            'Dossier XML :',
            XML_DIRECTORY
        );

    } catch (error) {
        console.error(
            'Erreur création dossier XML:',
            error.message
        );
    }

    try {
        await getDatabase();

        console.log(
            'Base de données initialisée'
        );

    } catch (error) {
        console.error(
            'Erreur base de données:',
            error.message
        );
    }

    app.listen(
        PORT,
        '0.0.0.0',
        () => {
            console.log(
                `Serveur Valeo démarré sur http://localhost:${PORT}`
            );

            console.log(
                `Python utilisé : ${pythonCommand}`
            );

            console.log(
                `Plateforme : ${process.platform}`
            );

            console.log(
                `Cognex Python : ${path.join(__dirname, 'cognex_camera.py')}`
            );
        }
    );
}

startServer();
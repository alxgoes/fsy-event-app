package br.com.fsyrp2.app.ui.icons

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp

/*
 * Família de ícones FSY nativa — derivada do Lucide (lucide-static 0.460.0),
 * a mesma biblioteca usada no portal web. Traço 2 (24 dp), pontas e junções
 * arredondadas, sem preenchimento.
 *
 * Lucide — ISC License. Copyright (c) Lucide Contributors 2022.
 * Partes derivadas do Feather — MIT License. Copyright (c) 2013-2022 Cole Bemis.
 * https://lucide.dev/license — texto integral em docs/android/DESIGN-NATIVO.md §Atribuições.
 *
 * Gerado a partir dos SVG oficiais; não editar caminhos manualmente.
 */
object FsyIcons {
    /** Lucide `arrow-down` */
    val ArrowDown: ImageVector by lazy {
        lucide(
            "ArrowDown",
            "M12 5v14",
            "m19 12-7 7-7-7",
        )
    }

    /** Lucide `arrow-left` */
    val ArrowLeft: ImageVector by lazy {
        lucide(
            "ArrowLeft",
            "m12 19-7-7 7-7",
            "M19 12H5",
        )
    }

    /** Lucide `arrow-right` */
    val ArrowRight: ImageVector by lazy {
        lucide(
            "ArrowRight",
            "M5 12h14",
            "m12 5 7 7-7 7",
        )
    }

    /** Lucide `arrow-up` */
    val ArrowUp: ImageVector by lazy {
        lucide(
            "ArrowUp",
            "m5 12 7-7 7 7",
            "M12 19V5",
        )
    }

    /** Lucide `bed-double` */
    val BedDouble: ImageVector by lazy {
        lucide(
            "BedDouble",
            "M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8",
            "M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4",
            "M12 4v6",
            "M2 18h20",
        )
    }

    /** Lucide `bell-off` */
    val BellOff: ImageVector by lazy {
        lucide(
            "BellOff",
            "M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5",
            "M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7",
            "M10.3 21a1.94 1.94 0 0 0 3.4 0",
            "m2 2 20 20",
        )
    }

    /** Lucide `bell-ring` */
    val BellRing: ImageVector by lazy {
        lucide(
            "BellRing",
            "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9",
            "M10.3 21a1.94 1.94 0 0 0 3.4 0",
            "M4 2C2.8 3.7 2 5.7 2 8",
            "M22 8c0-2.3-.8-4.3-2-6",
        )
    }

    /** Lucide `bell` */
    val Bell: ImageVector by lazy {
        lucide(
            "Bell",
            "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9",
            "M10.3 21a1.94 1.94 0 0 0 3.4 0",
        )
    }

    /** Lucide `book-open` */
    val BookOpen: ImageVector by lazy {
        lucide(
            "BookOpen",
            "M12 7v14",
            "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
        )
    }

    /** Lucide `bus` */
    val Bus: ImageVector by lazy {
        lucide(
            "Bus",
            "M8 6v6",
            "M15 6v6",
            "M2 12h19.6",
            "M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3",
            "M5 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0z",
            "M9 18h5",
            "M14 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0z",
        )
    }

    /** Lucide `calendar-clock` */
    val CalendarClock: ImageVector by lazy {
        lucide(
            "CalendarClock",
            "M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5",
            "M16 2v4",
            "M8 2v4",
            "M3 10h5",
            "M17.5 17.5 16 16.3V14",
            "M10 16a6 6 0 1 0 12 0a6 6 0 1 0 -12 0z",
        )
    }

    /** Lucide `calendar-days` */
    val CalendarDays: ImageVector by lazy {
        lucide(
            "CalendarDays",
            "M8 2v4",
            "M16 2v4",
            "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2z",
            "M3 10h18",
            "M8 14h.01",
            "M12 14h.01",
            "M16 14h.01",
            "M8 18h.01",
            "M12 18h.01",
            "M16 18h.01",
        )
    }

    /** Lucide `camera` */
    val Camera: ImageVector by lazy {
        lucide(
            "Camera",
            "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z",
            "M9 13a3 3 0 1 0 6 0a3 3 0 1 0 -6 0z",
        )
    }

    /** Lucide `check` */
    val Check: ImageVector by lazy {
        lucide(
            "Check",
            "M20 6 9 17l-5-5",
        )
    }

    /** Lucide `chevron-down` */
    val ChevronDown: ImageVector by lazy {
        lucide(
            "ChevronDown",
            "m6 9 6 6 6-6",
        )
    }

    /** Lucide `chevron-left` */
    val ChevronLeft: ImageVector by lazy {
        lucide(
            "ChevronLeft",
            "m15 18-6-6 6-6",
        )
    }

    /** Lucide `chevron-right` */
    val ChevronRight: ImageVector by lazy {
        lucide(
            "ChevronRight",
            "m9 18 6-6-6-6",
        )
    }

    /** Lucide `chevrons-left-right` */
    val ChevronsLeftRight: ImageVector by lazy {
        lucide(
            "ChevronsLeftRight",
            "m9 7-5 5 5 5",
            "m15 7 5 5-5 5",
        )
    }

    /** Lucide `circle-alert` */
    val CircleAlert: ImageVector by lazy {
        lucide(
            "CircleAlert",
            "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0z",
            "M12 8L12 12",
            "M12 16L12.01 16",
        )
    }

    /** Lucide `circle-check` */
    val CircleCheck: ImageVector by lazy {
        lucide(
            "CircleCheck",
            "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0z",
            "m9 12 2 2 4-4",
        )
    }

    /** Lucide `clipboard-check` */
    val ClipboardCheck: ImageVector by lazy {
        lucide(
            "ClipboardCheck",
            "M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1z",
            "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
            "m9 14 2 2 4-4",
        )
    }

    /** Lucide `clipboard-list` */
    val ClipboardList: ImageVector by lazy {
        lucide(
            "ClipboardList",
            "M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1z",
            "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
            "M12 11h4",
            "M12 16h4",
            "M8 11h.01",
            "M8 16h.01",
        )
    }

    /** Lucide `clock` */
    val Clock: ImageVector by lazy {
        lucide(
            "Clock",
            "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0z",
            "M12 6L12 12L16 14",
        )
    }

    /** Lucide `cloud-off` */
    val CloudOff: ImageVector by lazy {
        lucide(
            "CloudOff",
            "m2 2 20 20",
            "M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193",
            "M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07",
        )
    }

    /** Lucide `compass` */
    val Compass: ImageVector by lazy {
        lucide(
            "Compass",
            "m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z",
            "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0z",
        )
    }

    /** Lucide `copy` */
    val Copy: ImageVector by lazy {
        lucide(
            "Copy",
            "M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2z",
            "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",
        )
    }

    /** Lucide `download` */
    val Download: ImageVector by lazy {
        lucide(
            "Download",
            "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
            "M7 10L12 15L17 10",
            "M12 15L12 3",
        )
    }

    /** Lucide `ellipsis-vertical` */
    val EllipsisVertical: ImageVector by lazy {
        lucide(
            "EllipsisVertical",
            "M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0z",
            "M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0z",
            "M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0z",
        )
    }

    /** Lucide `external-link` */
    val ExternalLink: ImageVector by lazy {
        lucide(
            "ExternalLink",
            "M15 3h6v6",
            "M10 14 21 3",
            "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
        )
    }

    /** Lucide `eye-off` */
    val EyeOff: ImageVector by lazy {
        lucide(
            "EyeOff",
            "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",
            "M14.084 14.158a3 3 0 0 1-4.242-4.242",
            "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",
            "m2 2 20 20",
        )
    }

    /** Lucide `eye` */
    val Eye: ImageVector by lazy {
        lucide(
            "Eye",
            "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
            "M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0z",
        )
    }

    /** Lucide `file-down` */
    val FileDown: ImageVector by lazy {
        lucide(
            "FileDown",
            "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",
            "M14 2v4a2 2 0 0 0 2 2h4",
            "M12 18v-6",
            "m9 15 3 3 3-3",
        )
    }

    /** Lucide `file-spreadsheet` */
    val FileSpreadsheet: ImageVector by lazy {
        lucide(
            "FileSpreadsheet",
            "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",
            "M14 2v4a2 2 0 0 0 2 2h4",
            "M8 13h2",
            "M14 13h2",
            "M8 17h2",
            "M14 17h2",
        )
    }

    /** Lucide `file-text` */
    val FileText: ImageVector by lazy {
        lucide(
            "FileText",
            "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",
            "M14 2v4a2 2 0 0 0 2 2h4",
            "M10 9H8",
            "M16 13H8",
            "M16 17H8",
        )
    }

    /** Lucide `filter` */
    val Filter: ImageVector by lazy {
        lucide(
            "Filter",
            "M22 3L2 3L10 12.46L10 19L14 21L14 12.46L22 3z",
        )
    }

    /** Lucide `folder-archive` */
    val FolderArchive: ImageVector by lazy {
        lucide(
            "FolderArchive",
            "M13 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0z",
            "M20.9 19.8A2 2 0 0 0 22 18V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h5.1",
            "M15 11v-1",
            "M15 17v-2",
        )
    }

    /** Lucide `grip-vertical` */
    val GripVertical: ImageVector by lazy {
        lucide(
            "GripVertical",
            "M8 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0z",
            "M8 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0z",
            "M8 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0z",
            "M14 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0z",
            "M14 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0z",
            "M14 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0z",
        )
    }

    /** Lucide `hand-heart` */
    val HandHeart: ImageVector by lazy {
        lucide(
            "HandHeart",
            "M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16",
            "m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9",
            "m2 15 6 6",
            "M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.73 2.73 0 0 0 16 4a2.78 2.78 0 0 0-5 1.8c0 1.2.8 2 1.5 2.8L16 12Z",
        )
    }

    /** Lucide `heart-pulse` */
    val HeartPulse: ImageVector by lazy {
        lucide(
            "HeartPulse",
            "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
            "M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27",
        )
    }

    /** Lucide `heart` */
    val Heart: ImageVector by lazy {
        lucide(
            "Heart",
            "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
        )
    }

    /** Lucide `history` */
    val History: ImageVector by lazy {
        lucide(
            "History",
            "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",
            "M3 3v5h5",
            "M12 7v5l4 2",
        )
    }

    /** Lucide `hotel` */
    val Hotel: ImageVector by lazy {
        lucide(
            "Hotel",
            "M10 22v-6.57",
            "M12 11h.01",
            "M12 7h.01",
            "M14 15.43V22",
            "M15 16a5 5 0 0 0-6 0",
            "M16 11h.01",
            "M16 7h.01",
            "M8 11h.01",
            "M8 7h.01",
            "M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-16a2 2 0 0 1 2 -2z",
        )
    }

    /** Lucide `house` */
    val House: ImageVector by lazy {
        lucide(
            "House",
            "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8",
            "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
        )
    }

    /** Lucide `image` */
    val Image: ImageVector by lazy {
        lucide(
            "Image",
            "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2z",
            "M7 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0z",
            "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",
        )
    }

    /** Lucide `images` */
    val Images: ImageVector by lazy {
        lucide(
            "Images",
            "M18 22H4a2 2 0 0 1-2-2V6",
            "m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18",
            "M10 8a2 2 0 1 0 4 0a2 2 0 1 0 -4 0z",
            "M8 2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2z",
        )
    }

    /** Lucide `info` */
    val Info: ImageVector by lazy {
        lucide(
            "Info",
            "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0z",
            "M12 16v-4",
            "M12 8h.01",
        )
    }

    /** Lucide `key-round` */
    val KeyRound: ImageVector by lazy {
        lucide(
            "KeyRound",
            "M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z",
            "M16 7.5a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0z",
        )
    }

    /** Lucide `layout-dashboard` */
    val LayoutDashboard: ImageVector by lazy {
        lucide(
            "LayoutDashboard",
            "M4 3h5a1 1 0 0 1 1 1v7a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-7a1 1 0 0 1 1 -1z",
            "M15 3h5a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1z",
            "M15 12h5a1 1 0 0 1 1 1v7a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-7a1 1 0 0 1 1 -1z",
            "M4 16h5a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1z",
        )
    }

    /** Lucide `layout-grid` */
    val LayoutGrid: ImageVector by lazy {
        lucide(
            "LayoutGrid",
            "M4 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1z",
            "M15 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1z",
            "M15 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1z",
            "M4 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1z",
        )
    }

    /** Lucide `list-checks` */
    val ListChecks: ImageVector by lazy {
        lucide(
            "ListChecks",
            "m3 17 2 2 4-4",
            "m3 7 2 2 4-4",
            "M13 6h8",
            "M13 12h8",
            "M13 18h8",
        )
    }

    /** Lucide `lock` */
    val Lock: ImageVector by lazy {
        lucide(
            "Lock",
            "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-7a2 2 0 0 1 2 -2z",
            "M7 11V7a5 5 0 0 1 10 0v4",
        )
    }

    /** Lucide `log-out` */
    val LogOut: ImageVector by lazy {
        lucide(
            "LogOut",
            "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",
            "M16 17L21 12L16 7",
            "M21 12L9 12",
        )
    }

    /** Lucide `mail` */
    val Mail: ImageVector by lazy {
        lucide(
            "Mail",
            "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2z",
            "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7",
        )
    }

    /** Lucide `map-pin` */
    val MapPin: ImageVector by lazy {
        lucide(
            "MapPin",
            "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",
            "M9 10a3 3 0 1 0 6 0a3 3 0 1 0 -6 0z",
        )
    }

    /** Lucide `megaphone` */
    val Megaphone: ImageVector by lazy {
        lucide(
            "Megaphone",
            "m3 11 18-5v12L3 14v-3z",
            "M11.6 16.8a3 3 0 1 1-5.8-1.6",
        )
    }

    /** Lucide `moon` */
    val Moon: ImageVector by lazy {
        lucide(
            "Moon",
            "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z",
        )
    }

    /** Lucide `music` */
    val Music: ImageVector by lazy {
        lucide(
            "Music",
            "M9 18V5l12-2v13",
            "M3 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0z",
            "M15 16a3 3 0 1 0 6 0a3 3 0 1 0 -6 0z",
        )
    }

    /** Lucide `pause` */
    val Pause: ImageVector by lazy {
        lucide(
            "Pause",
            "M15 4h2a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1z",
            "M7 4h2a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1z",
        )
    }

    /** Lucide `pencil` */
    val Pencil: ImageVector by lazy {
        lucide(
            "Pencil",
            "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
            "m15 5 4 4",
        )
    }

    /** Lucide `phone` */
    val Phone: ImageVector by lazy {
        lucide(
            "Phone",
            "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",
        )
    }

    /** Lucide `play` */
    val Play: ImageVector by lazy {
        lucide(
            "Play",
            "M6 3L20 12L6 21L6 3z",
        )
    }

    /** Lucide `menu` */
    val Menu: ImageVector by lazy {
        lucide(
            "Menu",
            "M4 12h16",
            "M4 6h16",
            "M4 18h16",
        )
    }

    /** Lucide `image-plus` */
    val ImagePlus: ImageVector by lazy {
        lucide(
            "ImagePlus",
            "M16 5h6",
            "M19 2v6",
            "M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5",
            "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",
            "M7 9a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
        )
    }

    /** Lucide `plus` */
    val Plus: ImageVector by lazy {
        lucide(
            "Plus",
            "M5 12h14",
            "M12 5v14",
        )
    }

    /** Lucide `refresh-cw` */
    val RefreshCw: ImageVector by lazy {
        lucide(
            "RefreshCw",
            "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",
            "M21 3v5h-5",
            "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",
            "M8 16H3v5",
        )
    }

    /** Lucide `rotate-ccw` */
    val RotateCcw: ImageVector by lazy {
        lucide(
            "RotateCcw",
            "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",
            "M3 3v5h5",
        )
    }

    /** Lucide `school` */
    val School: ImageVector by lazy {
        lucide(
            "School",
            "M14 22v-4a2 2 0 1 0-4 0v4",
            "m18 10 3.447 1.724a1 1 0 0 1 .553.894V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7.382a1 1 0 0 1 .553-.894L6 10",
            "M18 5v17",
            "m4 6 7.106-3.553a2 2 0 0 1 1.788 0L20 6",
            "M6 5v17",
            "M10 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0z",
        )
    }

    /** Lucide `search` */
    val Search: ImageVector by lazy {
        lucide(
            "Search",
            "M3 11a8 8 0 1 0 16 0a8 8 0 1 0 -16 0z",
            "m21 21-4.3-4.3",
        )
    }

    /** Lucide `send` */
    val Send: ImageVector by lazy {
        lucide(
            "Send",
            "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",
            "m21.854 2.147-10.94 10.939",
        )
    }

    /** Lucide `shield-check` */
    val ShieldCheck: ImageVector by lazy {
        lucide(
            "ShieldCheck",
            "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
            "m9 12 2 2 4-4",
        )
    }

    /** Lucide `shield` */
    val Shield: ImageVector by lazy {
        lucide(
            "Shield",
            "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
        )
    }

    /** Lucide `sliders-horizontal` */
    val SlidersHorizontal: ImageVector by lazy {
        lucide(
            "SlidersHorizontal",
            "M21 4L14 4",
            "M10 4L3 4",
            "M21 12L12 12",
            "M8 12L3 12",
            "M21 20L16 20",
            "M12 20L3 20",
            "M14 2L14 6",
            "M8 10L8 14",
            "M16 18L16 22",
        )
    }

    /** Lucide `sparkles` */
    val Sparkles: ImageVector by lazy {
        lucide(
            "Sparkles",
            "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
            "M20 3v4",
            "M22 5h-4",
            "M4 17v2",
            "M5 18H3",
        )
    }

    /** Lucide `stethoscope` */
    val Stethoscope: ImageVector by lazy {
        lucide(
            "Stethoscope",
            "M11 2v2",
            "M5 2v2",
            "M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1",
            "M8 15a6 6 0 0 0 12 0v-3",
            "M18 10a2 2 0 1 0 4 0a2 2 0 1 0 -4 0z",
        )
    }

    /** Lucide `sun-moon` */
    val SunMoon: ImageVector by lazy {
        lucide(
            "SunMoon",
            "M12 8a2.83 2.83 0 0 0 4 4 4 4 0 1 1-4-4",
            "M12 2v2",
            "M12 20v2",
            "m4.9 4.9 1.4 1.4",
            "m17.7 17.7 1.4 1.4",
            "M2 12h2",
            "M20 12h2",
            "m6.3 17.7-1.4 1.4",
            "m19.1 4.9-1.4 1.4",
        )
    }

    /** Lucide `sun` */
    val Sun: ImageVector by lazy {
        lucide(
            "Sun",
            "M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0z",
            "M12 2v2",
            "M12 20v2",
            "m4.93 4.93 1.41 1.41",
            "m17.66 17.66 1.41 1.41",
            "M2 12h2",
            "M20 12h2",
            "m6.34 17.66-1.41 1.41",
            "m19.07 4.93-1.41 1.41",
        )
    }

    /** Lucide `trash-2` */
    val Trash2: ImageVector by lazy {
        lucide(
            "Trash2",
            "M3 6h18",
            "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6",
            "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2",
            "M10 11L10 17",
            "M14 11L14 17",
        )
    }

    /** Lucide `triangle-alert` */
    val TriangleAlert: ImageVector by lazy {
        lucide(
            "TriangleAlert",
            "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
            "M12 9v4",
            "M12 17h.01",
        )
    }

    /** Lucide `upload` */
    val Upload: ImageVector by lazy {
        lucide(
            "Upload",
            "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
            "M17 8L12 3L7 8",
            "M12 3L12 15",
        )
    }

    /** Lucide `user-check` */
    val UserCheck: ImageVector by lazy {
        lucide(
            "UserCheck",
            "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
            "M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0z",
            "M16 11L18 13L22 9",
        )
    }

    /** Lucide `user-cog` */
    val UserCog: ImageVector by lazy {
        lucide(
            "UserCog",
            "M15 15a3 3 0 1 0 6 0a3 3 0 1 0 -6 0z",
            "M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0z",
            "M10 15H6a4 4 0 0 0-4 4v2",
            "m21.7 16.4-.9-.3",
            "m15.2 13.9-.9-.3",
            "m16.6 18.7.3-.9",
            "m19.1 12.2.3-.9",
            "m19.6 18.7-.4-1",
            "m16.8 12.3-.4-1",
            "m14.3 16.6 1-.4",
            "m20.7 13.8 1-.4",
        )
    }

    /** Lucide `user-round` */
    val UserRound: ImageVector by lazy {
        lucide(
            "UserRound",
            "M7 8a5 5 0 1 0 10 0a5 5 0 1 0 -10 0z",
            "M20 21a8 8 0 0 0-16 0",
        )
    }

    /** Lucide `users` */
    val Users: ImageVector by lazy {
        lucide(
            "Users",
            "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
            "M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0z",
            "M22 21v-2a4 4 0 0 0-3-3.87",
            "M16 3.13a4 4 0 0 1 0 7.75",
        )
    }

    /** Lucide `utensils` */
    val Utensils: ImageVector by lazy {
        lucide(
            "Utensils",
            "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2",
            "M7 2v20",
            "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7",
        )
    }

    /** Lucide `wifi-off` */
    val WifiOff: ImageVector by lazy {
        lucide(
            "WifiOff",
            "M12 20h.01",
            "M8.5 16.429a5 5 0 0 1 7 0",
            "M5 12.859a10 10 0 0 1 5.17-2.69",
            "M19 12.859a10 10 0 0 0-2.007-1.523",
            "M2 8.82a15 15 0 0 1 4.177-2.643",
            "M22 8.82a15 15 0 0 0-11.288-3.764",
            "m2 2 20 20",
        )
    }

    /** Lucide `x` */
    val X: ImageVector by lazy {
        lucide(
            "X",
            "M18 6 6 18",
            "m6 6 12 12",
        )
    }
}

private fun lucide(name: String, vararg paths: String): ImageVector =
    ImageVector.Builder(
        name = name,
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f,
    ).apply {
        paths.forEach { data ->
            addPath(
                pathData = addPathNodes(data),
                fill = null,
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
            )
        }
    }.build()

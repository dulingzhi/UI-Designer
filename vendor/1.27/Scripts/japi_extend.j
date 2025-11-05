
// texttag
native DzTextTagGetFont takes nothing returns string
native DzTextTagSetFont takes string fileName returns nothing
native DzTextTagSetStartAlpha takes texttag t, integer alpha returns nothing
native DzTextTagGetShadowColor takes texttag t returns integer
native DzTextTagSetShadowColor takes texttag t, integer color returns nothing

// group
native DzGroupGetCount takes group g returns integer
native DzGroupGetUnitAt takes group g, integer index returns unit

// unit
native DzUnitCreateIllusion takes player p, integer unitId, real x, real y, real face returns unit
native DzUnitCreateIllusionFromUnit takes unit u returns unit

// issue
native DzQueueGroupImmediateOrderById              takes group whichGroup, integer order returns boolean
native DzQueueGroupPointOrderById                  takes group whichGroup, integer order, real x, real y returns boolean
native DzQueueGroupTargetOrderById                 takes group whichGroup, integer order, widget targetWidget returns boolean
native DzQueueIssueImmediateOrderById      takes unit whichUnit, integer order returns boolean
native DzQueueIssuePointOrderById          takes unit whichUnit, integer order, real x, real y returns boolean
native DzQueueIssueTargetOrderById         takes unit whichUnit, integer order, widget targetWidget returns boolean
native DzQueueIssueInstantPointOrderById   takes unit whichUnit, integer order, real x, real y, widget instantTargetWidget returns boolean
native DzQueueIssueInstantTargetOrderById  takes unit whichUnit, integer order, widget targetWidget, widget instantTargetWidget returns boolean
native DzQueueIssueBuildOrderById          takes unit whichPeon, integer unitId, real x, real y returns boolean
native DzQueueIssueNeutralImmediateOrderById   takes player forWhichPlayer,unit neutralStructure, integer unitId returns boolean
native DzQueueIssueNeutralPointOrderById       takes player forWhichPlayer,unit neutralStructure, integer unitId, real x, real y returns boolean
native DzQueueIssueNeutralTargetOrderById      takes player forWhichPlayer,unit neutralStructure, integer unitId, widget target returns boolean
native DzUnitOrdersCount takes unit u returns integer
native DzUnitOrdersReverse takes unit u returns nothing
native DzUnitOrdersClear takes unit u, boolean onlyQueued returns nothing
native DzUnitOrdersExec takes unit u returns nothing
native DzUnitOrdersForceStop takes unit u, boolean clearQueue returns nothing

// string
native DzStringContains takes string s, string whichString, boolean caseSensitive returns boolean
native DzStringFind takes string s, string whichString, integer off, boolean caseSensitive returns integer
native DzStringFindFirstOf takes string s, string whichString, integer off, boolean caseSensitive returns integer
native DzStringFindFirstNotOf takes string s, string whichString, integer off, boolean caseSensitive returns integer
native DzStringFindLastOf takes string s, string whichString, integer off, boolean caseSensitive returns integer
native DzStringFindLastNotOf takes string s, string whichString, integer off, boolean caseSensitive returns integer
native DzStringTrimLeft takes string s returns string
native DzStringTrimRight takes string s returns string
native DzStringTrim takes string s returns string
native DzStringReverse takes string s returns string
native DzStringReplace takes string s, string whichString, string replaceWith, boolean caseSensitive returns string
native DzStringInsert takes string s, integer whichPosition, string whichString returns string


// bit
native DzBitGet takes integer i, integer byteIndex returns integer
native DzBitSet takes integer i, integer byteIndex, integer byteValue returns integer
native DzBitGetByte takes integer i, integer byteIndex returns integer
native DzBitSetByte takes integer i, integer byteIndex, integer byteValue returns integer
native DzBitNot takes integer i returns integer
native DzBitAnd takes integer a, integer b returns integer
native DzBitOr takes integer a, integer b returns integer
native DzBitXor takes integer a, integer b returns integer
native DzBitShiftLeft takes integer i, integer bitsToShift returns integer
native DzBitShiftRight takes integer i, integer bitsToShift returns integer
native DzBitToInt takes integer b1, integer b2, integer b3, integer b4 returns integer

// xlsx
native DzXlsxOpen takes string filePath returns integer
native DzXlsxClose takes integer docHandle returns boolean
native DzXlsxWorksheetGetRowCount takes integer docHandle, string sheetName returns integer
native DzXlsxWorksheetGetColumnCount takes integer docHandle, string sheetName returns integer
// enum class XlsxValueType
// {
//     None = 0,
//     String = 1,
//     Integer = 2,
//     Bool = 3,
//     Real = 4,
// };
native DzXlsxWorksheetGetCellType takes integer docHandle, string sheetName, integer row, integer column returns integer
native DzXlsxWorksheetGetCellString takes integer docHandle, string sheetName, integer row, integer column returns string
native DzXlsxWorksheetGetCellInteger takes integer docHandle, string sheetName, integer row, integer column returns integer
native DzXlsxWorksheetGetCellBoolean takes integer docHandle, string sheetName, integer row, integer column returns boolean
native DzXlsxWorksheetGetCellFloat takes integer docHandle, string sheetName, integer row, integer column returns real

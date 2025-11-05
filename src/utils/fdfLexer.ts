/**
 * FDF 词法分析器 (Lexer)
 * 
 * 将 FDF 文本转换为 Token 流
 */

// ==================== Token 类型 ====================

export enum TokenType {
  // 字面量
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  IDENTIFIER = 'IDENTIFIER',
  
  // 关键字
  FRAME = 'FRAME',
  INHERITS = 'INHERITS',
  WITHCHILDREN = 'WITHCHILDREN',
  INCLUDE_FILE = 'INCLUDE_FILE',
  
  // 符号
  LEFT_BRACE = 'LEFT_BRACE',
  RIGHT_BRACE = 'RIGHT_BRACE',
  COMMA = 'COMMA',
  
  // 特殊
  COMMENT = 'COMMENT',
  NEWLINE = 'NEWLINE',
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

// ==================== 词法分析器 ====================

export class FDFLexer {
  private input: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  
  constructor(input: string) {
    this.input = input;
  }
  
  /**
   * 获取当前字符
   */
  private current(): string {
    return this.input[this.position] || '';
  }
  
  /**
   * 查看下一个字符（不移动位置）
   */
  private peek(offset: number = 1): string {
    return this.input[this.position + offset] || '';
  }
  
  /**
   * 前进一个字符
   */
  private advance(): string {
    const char = this.current();
    this.position++;
    
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    
    return char;
  }
  
  /**
   * 跳过空白字符（不包括换行）
   */
  private skipWhitespace(): void {
    while (this.current() && /[ \t\r]/.test(this.current())) {
      this.advance();
    }
  }
  
  /**
   * 跳过注释
   */
  private skipComment(): Token | null {
    const startLine = this.line;
    const startColumn = this.column;
    
    // 单行注释 "//"
    if (this.current() === '/' && this.peek() === '/') {
      this.advance(); // /
      this.advance(); // /
      
      let value = '';
      while (this.current() && this.current() !== '\n') {
        value += this.advance();
      }
      
      return {
        type: TokenType.COMMENT,
        value: value.trim(),
        line: startLine,
        column: startColumn,
      };
    }
    
    // 多行注释 "/* */"
    if (this.current() === '/' && this.peek() === '*') {
      this.advance(); // /
      this.advance(); // *
      
      let value = '';
      while (this.current() && !(this.current() === '*' && this.peek() === '/')) {
        value += this.advance();
      }
      
      if (this.current() === '*') {
        this.advance(); // *
        this.advance(); // /
      }
      
      return {
        type: TokenType.COMMENT,
        value: value.trim(),
        line: startLine,
        column: startColumn,
      };
    }
    
    return null;
  }
  
  /**
   * 读取字符串字面量
   */
  private readString(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    const quote = this.advance(); // " 或 '
    
    let value = '';
    while (this.current() && this.current() !== quote) {
      if (this.current() === '\\') {
        this.advance();
        const escaped = this.advance();
        // 处理转义字符
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          case '\\': value += '\\'; break;
          case '"': value += '"'; break;
          case "'": value += "'"; break;
          default: value += escaped;
        }
      } else {
        value += this.advance();
      }
    }
    
    if (this.current() === quote) {
      this.advance(); // 结束引号
    }
    
    return {
      type: TokenType.STRING,
      value,
      line: startLine,
      column: startColumn,
    };
  }
  
  /**
   * 读取数字字面量
   */
  private readNumber(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    
    let value = '';
    
    // 处理负号
    if (this.current() === '-') {
      value += this.advance();
    }
    
    // 读取整数部分
    while (this.current() && /[0-9]/.test(this.current())) {
      value += this.advance();
    }
    
    // 读取小数部分
    if (this.current() === '.' && /[0-9]/.test(this.peek())) {
      value += this.advance(); // .
      while (this.current() && /[0-9]/.test(this.current())) {
        value += this.advance();
      }
    }
    
    // 读取科学计数法
    if (this.current() === 'e' || this.current() === 'E') {
      value += this.advance(); // e/E
      if (this.current() === '+' || this.current() === '-') {
        value += this.advance();
      }
      while (this.current() && /[0-9]/.test(this.current())) {
        value += this.advance();
      }
    }
    
    return {
      type: TokenType.NUMBER,
      value,
      line: startLine,
      column: startColumn,
    };
  }
  
  /**
   * 读取标识符或关键字
   */
  private readIdentifier(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    
    let value = '';
    while (this.current() && /[a-zA-Z0-9_]/.test(this.current())) {
      value += this.advance();
    }
    
    // 检查是否是关键字
    const upperValue = value.toUpperCase();
    let type: TokenType;
    
    if (upperValue === 'FRAME') {
      type = TokenType.FRAME;
    } else if (upperValue === 'INHERITS') {
      type = TokenType.INHERITS;
    } else if (upperValue === 'WITHCHILDREN') {
      type = TokenType.WITHCHILDREN;
    } else if (upperValue === 'INCLUDEFILE') {
      type = TokenType.INCLUDE_FILE;
    } else {
      type = TokenType.IDENTIFIER;
    }
    
    return {
      type,
      value,
      line: startLine,
      column: startColumn,
    };
  }
  
  /**
   * 获取下一个 Token
   */
  public nextToken(): Token {
    // 跳过空白
    this.skipWhitespace();
    
    // 检查注释
    const comment = this.skipComment();
    if (comment) {
      return comment;
    }
    
    // 再次跳过空白（注释后可能有空白）
    this.skipWhitespace();
    
    const startLine = this.line;
    const startColumn = this.column;
    const char = this.current();
    
    // EOF
    if (!char) {
      return {
        type: TokenType.EOF,
        value: '',
        line: startLine,
        column: startColumn,
      };
    }
    
    // 换行
    if (char === '\n') {
      this.advance();
      return {
        type: TokenType.NEWLINE,
        value: '\n',
        line: startLine,
        column: startColumn,
      };
    }
    
    // 字符串
    if (char === '"' || char === "'") {
      return this.readString();
    }
    
    // 数字
    if (/[0-9]/.test(char) || (char === '-' && /[0-9]/.test(this.peek()))) {
      return this.readNumber();
    }
    
    // 标识符
    if (/[a-zA-Z_]/.test(char)) {
      return this.readIdentifier();
    }
    
    // 符号
    switch (char) {
      case '{':
        this.advance();
        return {
          type: TokenType.LEFT_BRACE,
          value: '{',
          line: startLine,
          column: startColumn,
        };
        
      case '}':
        this.advance();
        return {
          type: TokenType.RIGHT_BRACE,
          value: '}',
          line: startLine,
          column: startColumn,
        };
        
      case ',':
        this.advance();
        return {
          type: TokenType.COMMA,
          value: ',',
          line: startLine,
          column: startColumn,
        };
        
      default:
        // 未知字符，跳过
        this.advance();
        return this.nextToken();
    }
  }
  
  /**
   * 获取所有 Tokens
   */
  public tokenize(): Token[] {
    const tokens: Token[] = [];
    let token: Token;
    
    do {
      token = this.nextToken();
      // 跳过换行符（简化解析）
      if (token.type !== TokenType.NEWLINE) {
        tokens.push(token);
      }
    } while (token.type !== TokenType.EOF);
    
    return tokens;
  }
}

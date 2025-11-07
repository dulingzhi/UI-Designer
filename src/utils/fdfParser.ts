/**
 * FDF 语法分析器 (Parser)
 * 
 * 将 Token 流转换为 AST (抽象语法树)
 */

import {
  FDFProgram,
  FDFInclude,
  FDFFrameDefinition,
  FDFNestedFrame,
  FDFProperty,
  FDFPropertyValue,
  FDFNodeType,
} from './fdfAst';
import { Token, TokenType } from './fdfLexer';

export class FDFParser {
  private tokens: Token[];
  private current: number = 0;
  
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }
  
  /**
   * 获取当前 Token
   */
  private currentToken(): Token {
    return this.tokens[this.current] || this.tokens[this.tokens.length - 1];
  }
  
  /**
   * 查看下一个 Token（不移动位置）
   */
  private peek(offset: number = 1): Token {
    return this.tokens[this.current + offset] || this.tokens[this.tokens.length - 1];
  }
  
  /**
   * 前进一个 Token
   */
  private advance(): Token {
    const token = this.currentToken();
    if (this.current < this.tokens.length - 1) {
      this.current++;
    }
    return token;
  }
  
  /**
   * 期望特定类型的 Token
   */
  private expect(type: TokenType): Token {
    const token = this.currentToken();
    if (token.type !== type) {
      throw new Error(
        `Expected token type ${type} but got ${token.type} at line ${token.line}:${token.column}`
      );
    }
    return this.advance();
  }
  
  /**
   * 检查当前 Token 是否是特定类型
   */
  private check(type: TokenType): boolean {
    return this.currentToken().type === type;
  }
  
  /**
   * 跳过注释
   */
  private skipComments(): void {
    while (this.check(TokenType.COMMENT)) {
      this.advance();
    }
  }
  
  /**
   * 解析程序（顶层）
   */
  public parse(): FDFProgram {
    const body: FDFProgram['body'] = [];
    
    while (!this.check(TokenType.EOF)) {
      this.skipComments();
      
      if (this.check(TokenType.EOF)) {
        break;
      }
      
      // IncludeFile
      if (this.check(TokenType.INCLUDE_FILE)) {
        body.push(this.parseInclude());
      }
      // Frame 定义
      else if (this.check(TokenType.FRAME)) {
        const frame = this.parseFrameDefinition();
        body.push(frame);
      }
      // 未知，跳过
      else {
        this.advance();
      }
      
      this.skipComments();
    }
    
    return {
      type: FDFNodeType.PROGRAM,
      body,
    };
  }
  
  /**
   * 解析 IncludeFile
   * IncludeFile "path/to/file.fdf"
   */
  private parseInclude(): FDFInclude {
    this.expect(TokenType.INCLUDE_FILE);
    const pathToken = this.expect(TokenType.STRING);
    
    return {
      type: FDFNodeType.INCLUDE,
      path: pathToken.value,
      loc: {
        start: { line: pathToken.line, column: pathToken.column },
        end: { line: pathToken.line, column: pathToken.column },
      },
    };
  }
  
  /**
   * 解析 Frame 定义
   * Frame "TYPE" "Name" [INHERITS "Template"] { ... }
   */
  private parseFrameDefinition(): FDFFrameDefinition {
    const startToken = this.expect(TokenType.FRAME);
    
    const frameTypeToken = this.expect(TokenType.STRING);
    const frameType = frameTypeToken.value;
    
    const nameToken = this.expect(TokenType.STRING);
    const name = nameToken.value;
    
    // 可选的 INHERITS
    let inherits: string | undefined;
    let withChildren = false;
    
    if (this.check(TokenType.INHERITS)) {
      this.advance();
      
      // 检查可选的 WITHCHILDREN
      if (this.check(TokenType.WITHCHILDREN)) {
        withChildren = true;
        this.advance();
      }
      
      const inheritsToken = this.expect(TokenType.STRING);
      inherits = inheritsToken.value;
    }
    
    // 解析属性块
    this.expect(TokenType.LEFT_BRACE);
    const properties = this.parseProperties();
    this.expect(TokenType.RIGHT_BRACE);
    
    return {
      type: FDFNodeType.FRAME_DEFINITION,
      frameType,
      name,
      inherits,
      properties,
      loc: {
        start: { line: startToken.line, column: startToken.column },
        end: { line: this.currentToken().line, column: this.currentToken().column },
      },
    };
  }
  
  /**
   * 解析属性列表
   */
  private parseProperties(): (FDFProperty | FDFNestedFrame)[] {
    const properties: (FDFProperty | FDFNestedFrame)[] = [];
    
    while (!this.check(TokenType.RIGHT_BRACE) && !this.check(TokenType.EOF)) {
      // 跳过注释和换行符
      this.skipCommentsAndNewlines();
      
      if (this.check(TokenType.RIGHT_BRACE)) {
        break;
      }
      
      const currentType = this.currentToken().type;
      
      // 嵌套 Frame 定义：Frame "TYPE" "Name" { ... }
      if (currentType === TokenType.FRAME) {
        properties.push(this.parseNestedFrameDefinition());
      }
      // 嵌套特殊块 (Texture, String 等)
      else if (this.currentToken().value.toUpperCase() === 'TEXTURE' && this.peek().type === TokenType.LEFT_BRACE) {
        properties.push(this.parseNestedFrame('Texture'));
      } else if (this.currentToken().value.toUpperCase() === 'STRING' && this.peek().type === TokenType.LEFT_BRACE) {
        properties.push(this.parseNestedFrame('String'));
      }
      // 普通属性
      else if (currentType === TokenType.IDENTIFIER) {
        properties.push(this.parseProperty());
      }
      // 未知，跳过
      else {
        this.advance();
      }
    }
    
    return properties;
  }
  
  /**
   * 跳过注释和换行符
   */
  private skipCommentsAndNewlines(): void {
    while (this.check(TokenType.COMMENT) || this.check(TokenType.NEWLINE)) {
      this.advance();
    }
  }
  
  /**
   * 解析嵌套的 Frame 定义
   * Frame "TYPE" "Name" [INHERITS [WITHCHILDREN] "Template"] { ... }
   */
  private parseNestedFrameDefinition(): FDFNestedFrame {
    const startToken = this.expect(TokenType.FRAME);
    
    const frameTypeToken = this.expect(TokenType.STRING);
    const frameType = frameTypeToken.value;
    
    const nameToken = this.expect(TokenType.STRING);
    const name = nameToken.value;
    
    // 可选的 INHERITS [WITHCHILDREN] "Template"
    let inherits: string | undefined;
    
    if (this.check(TokenType.INHERITS)) {
      this.advance();
      
      // 检查可选的 WITHCHILDREN
      if (this.check(TokenType.WITHCHILDREN)) {
        this.advance();
      }
      
      inherits = this.expect(TokenType.STRING).value;
    }
    
    // 解析属性块
    this.expect(TokenType.LEFT_BRACE);
    const properties = this.parseProperties();
    this.expect(TokenType.RIGHT_BRACE);
    
    // 跳过可选的逗号
    if (this.check(TokenType.COMMA)) {
      this.advance();
    }
    
    return {
      type: FDFNodeType.NESTED_FRAME,
      frameType,
      name,
      inherits,
      properties,
      loc: {
        start: { line: startToken.line, column: startToken.column },
        end: { line: this.currentToken().line, column: this.currentToken().column },
      },
    };
  }
  
  /**
   * 解析嵌套 Frame
   * Texture { ... }
   * String "Name" { ... }
   */
  private parseNestedFrame(frameType: string): FDFNestedFrame {
    const startToken = this.advance(); // TEXTURE 或 STRING
    
    // 可选的名称
    let name: string | undefined;
    if (this.check(TokenType.STRING)) {
      name = this.advance().value;
    }
    
    // 可选的 INHERITS
    let inherits: string | undefined;
    if (this.check(TokenType.INHERITS)) {
      this.advance();
      inherits = this.expect(TokenType.STRING).value;
    }
    
    // 解析属性块
    this.expect(TokenType.LEFT_BRACE);
    const properties = this.parseProperties();
    this.expect(TokenType.RIGHT_BRACE);
    
    return {
      type: FDFNodeType.NESTED_FRAME,
      frameType,
      name,
      inherits,
      properties,
      loc: {
        start: { line: startToken.line, column: startToken.column },
        end: { line: this.currentToken().line, column: this.currentToken().column },
      },
    };
  }
  
  /**
   * 解析属性
   * PropertyName value
   * PropertyName value1, value2, value3
   */
  private parseProperty(): FDFProperty {
    const nameToken = this.expect(TokenType.IDENTIFIER);
    const name = nameToken.value;
    
    // 解析值
    const values: FDFPropertyValue[] = [];
    
    // 读取第一个值
    // 特殊处理：如果当前是 IDENTIFIER，需要判断是值还是下一个属性名
    if (this.check(TokenType.IDENTIFIER)) {
      const nextToken = this.peek();
      // 如果后面是逗号或其他值类型 token，当前 IDENTIFIER 是值
      if (nextToken.type === TokenType.COMMA || 
          nextToken.type === TokenType.STRING ||
          nextToken.type === TokenType.NUMBER) {
        values.push(this.parsePropertyValue());
      }
      // 否则，这个 IDENTIFIER 可能是下一个属性名，不读取
    } else if (!this.check(TokenType.RIGHT_BRACE) && 
               !this.check(TokenType.FRAME)) {
      values.push(this.parsePropertyValue());
    }
    
    // 读取后续值（用逗号分隔）
    while (this.check(TokenType.COMMA)) {
      this.advance(); // 跳过逗号
      
      // 跳过逗号后的换行符和注释
      this.skipCommentsAndNewlines();
      
      // 检查逗号后面是什么（已跳过换行符）
      if (this.check(TokenType.RIGHT_BRACE) || 
          this.check(TokenType.FRAME)) {
        // 逗号后是右大括号或 FRAME，说明这是行尾逗号
        break;
      } else if (this.check(TokenType.IDENTIFIER)) {
        const identifierValue = this.currentToken().value;
        // 首字母大写的标识符通常是属性名，不是值
        // 例如：BackdropBackground, BackdropCornerFlags, SetPoint 等
        // 小写标识符或特定关键字才是值，如：true, false, TOPLEFT, CENTER 等
        const firstChar = identifierValue.charAt(0);
        if (firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
          // 首字母是大写字母，认为这是新属性名，停止读取
          break;
        }
        
        // 否则，当作值处理（如枚举值、锚点等）
        values.push(this.parsePropertyValue());
      } else if (this.check(TokenType.STRING) || this.check(TokenType.NUMBER)) {
        // 逗号后是 STRING/NUMBER，继续读取
        values.push(this.parsePropertyValue());
      } else {
        // 其他情况，停止读取
        break;
      }
    }
    
    // 如果没有值，则为标志位属性（如 DecorateFileNames）
    let value: FDFPropertyValue;
    if (values.length === 0) {
      // 标志位属性，值为 true
      value = {
        type: FDFNodeType.IDENTIFIER,
        name: 'true',
      };
    } else if (values.length === 1) {
      value = values[0];
    } else {
      value = {
        type: FDFNodeType.ARRAY_LITERAL,
        elements: values,
      };
    }
    
    return {
      type: FDFNodeType.PROPERTY,
      name,
      value,
      loc: {
        start: { line: nameToken.line, column: nameToken.column },
        end: { line: this.currentToken().line, column: this.currentToken().column },
      },
    };
  }
  
  /**
   * 解析属性值
   */
  private parsePropertyValue(): FDFPropertyValue {
    const token = this.currentToken();
    
    // 字符串字面量
    if (this.check(TokenType.STRING)) {
      this.advance();
      return {
        type: FDFNodeType.STRING_LITERAL,
        value: token.value,
        loc: {
          start: { line: token.line, column: token.column },
          end: { line: token.line, column: token.column },
        },
      };
    }
    
    // 数字字面量
    if (this.check(TokenType.NUMBER)) {
      this.advance();
      return {
        type: FDFNodeType.NUMBER_LITERAL,
        value: parseFloat(token.value),
        loc: {
          start: { line: token.line, column: token.column },
          end: { line: token.line, column: token.column },
        },
      };
    }
    
    // 标识符
    if (this.check(TokenType.IDENTIFIER)) {
      this.advance();
      return {
        type: FDFNodeType.IDENTIFIER,
        name: token.value,
        loc: {
          start: { line: token.line, column: token.column },
          end: { line: token.line, column: token.column },
        },
      };
    }
    
    // 未知类型，跳过
    this.advance();
    return {
      type: FDFNodeType.IDENTIFIER,
      name: 'unknown',
    };
  }
}

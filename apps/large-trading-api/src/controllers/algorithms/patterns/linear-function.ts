export class LinearFunction {
  public m: number;
  public b: number;

  constructor(mOrX1: number, bOrY1: number, x2?: number, y2?: number) {
    if (x2 !== undefined && y2 !== undefined) {
      // Calculate slope (m) and y-intercept (b) from two points
      this.m = (y2 - bOrY1) / (x2 - mOrX1);
      this.b = bOrY1 - this.m * mOrX1;
    } else {
      // Initialize directly with m and b
      this.m = mOrX1;
      this.b = bOrY1;
    }
  }

  public getY(x: number): number {
    return this.m * x + this.b;
  }

  public isPointOnLine(x: number, y: number): boolean {
    return this.m * x + this.b === y;
  }
}
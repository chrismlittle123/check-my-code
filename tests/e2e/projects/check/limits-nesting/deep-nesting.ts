function deepNesting(a: boolean, b: boolean, c: boolean): void {
  if (a) {
    if (b) {
      if (c) {
        console.log("too deep");
      }
    }
  }
}

export { deepNesting };

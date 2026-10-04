export class TabPressActivation {
  private activated = false;

  begin(activate: () => void) {
    this.activated = true;
    activate();
  }

  commit(activate: () => void, held: boolean) {
    if (!held && !this.activated) activate();
    this.activated = false;
  }

  cancel() { this.activated = false; }
}

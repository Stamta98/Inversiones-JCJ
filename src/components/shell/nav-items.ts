/**
 * Serializable navigation model handed from the server layout to the client
 * shell. The AuthContext itself holds a translator function, so only this
 * plain shape crosses the boundary.
 */

export interface NavItem {
  key: string;
  label: string;
  route: string;
  icon: string;
  showInMobileNav: boolean;
  /** Cómo se llama en la barra de abajo, que puede ser más corto. */
  mobileLabel: string;
}

export interface ShellUser {
  fullName: string;
  email: string;
  roleName: string;
  companyName: string;
}

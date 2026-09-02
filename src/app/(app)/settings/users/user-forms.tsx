"use client";

import {
  Alert,
  Button,
  CardBody,
  Field,
  Input,
  Select,
} from "@/components/ui";
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  normalizeUsername,
  suggestUsername,
} from "@/core/users/username";
import { es } from "@/i18n/es";
import { useFormAction } from "@/lib/use-form-action";
import { useState } from "react";

import {
  createUserAction,
  resetPasswordAction,
  updateUserAction,
  type UserFormState,
} from "./actions";

export interface RoleOption {
  id: string;
  name: string;
}

export interface UserRow {
  id: string;
  fullName: string;
  email: string;
  username: string;
  phone: string | null;
  roleId: string;
  isActive: boolean;
}

function Estado({ state }: { state: UserFormState }) {
  if (state.error) return <Alert tone="danger">{state.error}</Alert>;
  if (state.success)
    return (
      <Alert tone="positive" icon="check">
        {state.success}
      </Alert>
    );
  return null;
}

export function NewUserForm({ roles }: { roles: RoleOption[] }) {
  const { state, pending, onSubmit } = useFormAction<UserFormState>(
    createUserAction,
    {},
  );
  // The username follows the email until somebody types their own.
  const [username, setUsername] = useState("");
  const [usernameEdited, setUsernameEdited] = useState(false);

  return (
    <form method="post" onSubmit={onSubmit}>
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Estado state={state} />
        </div>

        <Field label={es.settings.userFullName} htmlFor="fullName" required>
          <Input id="fullName" name="fullName" required autoFocus />
        </Field>

        <Field label={es.settings.userEmail} htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoCapitalize="none"
            onChange={(event) => {
              if (!usernameEdited) {
                setUsername(suggestUsername(event.target.value));
              }
            }}
            required
          />
        </Field>

        <Field
          label={es.settings.userUsername}
          htmlFor="username"
          hint={es.settings.userUsernameHint}
          required
        >
          <Input
            id="username"
            name="username"
            value={username}
            onChange={(event) => {
              setUsernameEdited(true);
              setUsername(normalizeUsername(event.target.value));
            }}
            minLength={USERNAME_MIN_LENGTH}
            maxLength={USERNAME_MAX_LENGTH}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </Field>

        <Field label={es.settings.userPhone} htmlFor="phone">
          <Input id="phone" name="phone" type="tel" inputMode="tel" />
        </Field>

        <Field label={es.settings.role} htmlFor="roleId" required>
          <Select id="roleId" name="roleId" required defaultValue="">
            <option value="" disabled>
              {es.common.selectOne}
            </option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={es.settings.userPassword}
          htmlFor="password"
          hint={es.settings.userPasswordHint}
          required
        >
          <Input
            id="password"
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </Field>

        <Field
          label={es.settings.userPasswordRepeat}
          htmlFor="passwordRepeat"
          required
        >
          <Input
            id="passwordRepeat"
            name="passwordRepeat"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </Field>

        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? es.common.saving : es.settings.newUser}
          </Button>
        </div>
      </CardBody>
    </form>
  );
}

export function EditUserForm({
  user,
  roles,
  canDeactivate,
}: {
  user: UserRow;
  roles: RoleOption[];
  /** False for your own account: you cannot lock yourself out. */
  canDeactivate: boolean;
}) {
  const { state, pending, onSubmit } = useFormAction<UserFormState>(
    updateUserAction,
    {},
  );

  return (
    <form method="post" onSubmit={onSubmit}>
      <input type="hidden" name="userId" value={user.id} />
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Estado state={state} />
        </div>

        <Field
          label={es.settings.userFullName}
          htmlFor={`fullName-${user.id}`}
          required
        >
          <Input
            id={`fullName-${user.id}`}
            name="fullName"
            defaultValue={user.fullName}
            required
          />
        </Field>

        <Field
          label={es.settings.userUsername}
          htmlFor={`username-${user.id}`}
          hint={es.settings.userUsernameHint}
          required
        >
          <Input
            id={`username-${user.id}`}
            name="username"
            defaultValue={user.username}
            minLength={USERNAME_MIN_LENGTH}
            maxLength={USERNAME_MAX_LENGTH}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </Field>

        <Field label={es.settings.userPhone} htmlFor={`phone-${user.id}`}>
          <Input
            id={`phone-${user.id}`}
            name="phone"
            type="tel"
            defaultValue={user.phone ?? ""}
          />
        </Field>

        <Field label={es.settings.role} htmlFor={`roleId-${user.id}`}>
          <Select
            id={`roleId-${user.id}`}
            name="roleId"
            defaultValue={user.roleId}
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={user.isActive}
              disabled={!canDeactivate}
              className="size-4 rounded border-border"
            />
            {es.settings.userActive}
          </label>
        </div>

        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? es.common.saving : es.common.save}
          </Button>
        </div>
      </CardBody>
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const { state, pending, onSubmit } = useFormAction<UserFormState>(
    resetPasswordAction,
    {},
  );

  return (
    <form method="post" onSubmit={onSubmit}>
      <input type="hidden" name="userId" value={userId} />
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Estado state={state} />
        </div>

        <Field
          label={es.settings.userPassword}
          htmlFor={`newPass-${userId}`}
          hint={es.settings.userPasswordHint}
          required
        >
          <Input
            id={`newPass-${userId}`}
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </Field>

        <Field
          label={es.settings.userPasswordRepeat}
          htmlFor={`newPass2-${userId}`}
          required
        >
          <Input
            id={`newPass2-${userId}`}
            name="passwordRepeat"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </Field>

        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            {pending ? es.common.saving : es.settings.resetPassword}
          </Button>
        </div>
      </CardBody>
    </form>
  );
}

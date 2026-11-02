import { expect, test } from "bun:test";
import { roleCan, rolePermissions } from "./access";

test("three fixed roles: tech < admin < owner", () => {
  const can = (role: string, permissions: Parameters<typeof roleCan>[1]) =>
    roleCan(role, permissions);
  expect(can("tech", { exception: ["flag", "comment"], run: ["upload"] })).toBe(
    true,
  );
  expect(can("tech", { exception: ["resolve"] })).toBe(false);
  expect(can("tech", { mapping: ["edit"] })).toBe(false);
  expect(can("admin", { exception: ["resolve"], mapping: ["edit"] })).toBe(
    true,
  );
  expect(can("admin", { invitation: ["create", "cancel"] })).toBe(true);
  expect(can("admin", { client: ["markup"] })).toBe(false);
  expect(can("admin", { billing: ["manage"] })).toBe(false);
  expect(can("admin", { member: ["delete"] })).toBe(false);
  expect(
    can("owner", {
      billing: ["manage"],
      client: ["markup"],
      organization: ["delete"],
      member: ["update", "delete"],
    }),
  ).toBe(true);
  expect(can("member", { exception: ["view"] })).toBe(false);
  expect(rolePermissions("tech")).toEqual({
    exception: ["view", "comment", "flag"],
    run: ["upload"],
  });
});

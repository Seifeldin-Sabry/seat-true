import { expect, test } from "bun:test";
import { selectClientsToKeep } from "./limits";
import { limitsFor } from "./plans";

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 1, 0, minutes));
const clients = [
  { id: "a", lastActiveAt: at(1) },
  { id: "b", lastActiveAt: at(5) },
  { id: "c", lastActiveAt: at(3) },
  { id: "d", lastActiveAt: at(3) },
];

test("unlimited or under-limit plans lock nothing", () => {
  expect(selectClientsToKeep(clients, null).lock).toEqual([]);
  expect(selectClientsToKeep(clients, 4).lock).toEqual([]);
});

test("least recently active clients are locked first, ties by id", () => {
  expect(selectClientsToKeep(clients, 2)).toEqual({
    keep: ["b", "c"],
    lock: ["d", "a"],
  });
});

test("explicit keep list wins and unknown ids are ignored", () => {
  expect(selectClientsToKeep(clients, 2, ["a", "zzz", "a"])).toEqual({
    keep: ["a", "b"],
    lock: ["c", "d"],
  });
});

test("selection is deterministic across replays", () => {
  const shuffled = [...clients].reverse();
  expect(selectClientsToKeep(shuffled, 3)).toEqual(
    selectClientsToKeep(clients, 3),
  );
});

test("plan limits come from the shared plans table", () => {
  expect(limitsFor("seattrue_starter_monthly")).toEqual({ clients: 50 });
  expect(limitsFor("seattrue_pro_monthly").clients).toBeNull();
<<<<<<< HEAD
  // No paid plan = Free.
  expect(limitsFor(null)).toEqual({ clients: 10 });
=======
  expect(limitsFor(null).clients).toBeNull();
>>>>>>> origin/claude/project-thread-gz1x6d
});

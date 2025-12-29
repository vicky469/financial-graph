// Entity Domain Operations

import { db, tx, recordEdit, getCurrentUser } from "../client";
import type { Entity } from "../../types";
import { generateEntityId } from "../../utils/idGenerator";

export const createEntity = (entity: Omit<Entity, "id" | "createdAt" | "createdBy">) => {
  const entityId = generateEntityId(entity.name);
  const currentUser = getCurrentUser();
  const data = {
    ...entity,
    createdAt: Date.now(),
    createdBy: currentUser.userName,
  };
  return db.transact([
    tx.entities[entityId].update(data),
    recordEdit("create_entity", entityId, "entity", undefined, data),
  ]);
};

export const updateEntity = (
  entityId: string,
  prev: Partial<Entity>,
  updates: Partial<Omit<Entity, "id" | "createdAt" | "createdBy">>
) =>
  db.transact([
    tx.entities[entityId].update(updates),
    recordEdit("update_entity", entityId, "entity", prev, updates),
  ]);

export const deleteEntity = (entityId: string, prev: Entity) =>
  db.transact([
    tx.entities[entityId].delete(),
    recordEdit("delete_entity", entityId, "entity", { ...prev }, undefined),
  ]);

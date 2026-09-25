# Resolve-Style Node Graph Contract

Status: LOCKED

This contract governs the Visual Framework node graph interaction model. It is a product behavior contract, not a visual suggestion.

DaVinci Resolve is the interaction reference for node-graph feel. Visual Framework remains an independent product.

## Z-order

Bottom to top:

1. Layers
2. Cables
3. Nodes
4. Live preview cable

The live preview cable must always render above nodes.

## Node movement

- Drag the node body to move a node.
- Nodes are never locked by a Layer.
- Connected cables follow continuously while the node moves.
- Existing node drag behavior must not change when Layers are added.

## Cable creation

- Start only from an Output.
- Click-drag from Output to Input.
- An Input accepts one execution cable.
- An Output may feed many Inputs.
- The cable snaps only when the pointer is within 20 screen pixels of a valid Input.
- On valid drop, create the connection.
- Connect feedback: target port pulse, cable snap animation, soft click.

## Cable detach and reconnect

- Click-drag from a connected Input.
- The existing cable visually pops off immediately and follows the pointer.
- The original connection remains provisional until drop so an invalid drop can be rejected cleanly.
- Drop on another valid Input: reconnect.
- Drop on empty graph space: delete the cable.
- Drop on an invalid target: reject the drop and restore the original cable.
- Detach feedback: input-port pop and soft click.

## Invalid connections

Invalid examples include:

- Output to Output
- Input to Input
- incompatible port types
- same-node execution connection
- any execution connection that would create a cycle

Behavior:

- live preview turns red
- connection is rejected
- canonical graph is not mutated

## Layer definition

A Layer is a named container for nodes and the cables attached to those nodes.

It is a folder-like graph container. It is not a Photoshop-style image layer and it does not change execution order.

### Rendering

- translucent panel behind contained nodes
- header bar displays the Layer name
- resize handles on all edges and corners

### Movement

- drag the Layer header
- Layer panel and all member nodes move as one unit
- cables between member nodes follow live
- cables crossing the Layer boundary stretch live to external nodes
- picking up a Layer produces the detach click
- dropping a Layer produces the connect click

### Resize

- drag any edge or corner
- resizing changes the Layer panel bounds only
- contained nodes retain their own positions
- node behavior remains unchanged

### Connections

- cross-Layer connections are allowed
- Layer membership never changes port compatibility
- Layer membership never changes execution semantics

### Delete

Deleting a Layer deletes:

- the Layer
- every node assigned to it
- every cable connected to those nodes

## Persistence

Layer position, size, name, and node membership are part of the Framework document and must survive local persistence, reload, undo/redo snapshots, and framework switching.

## Regression rule

No future shell, visual, hierarchy, AI, research, or workflow change may alter this interaction contract unless the contract itself is explicitly revised first.

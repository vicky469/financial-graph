// Sidebar - Main component with panels

import { useState } from "react";
import { useGraph } from "../../db";
import type { SidebarProps } from "../../types";
import { NodePanel } from "./NodePanel";
import { EdgePanel } from "./EdgePanel";
import { NodeTree } from "./NodeTree";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Sidebar = ({
  context,
  onFocusNode,
  onSelectNode,
  onSelectEdge,
  showNodes,
  onToggleNodes,
  showBrands,
  onToggleBrands,
}: SidebarProps) => {
  const { nodes: entities, edges } = useGraph();
  const [showNodesSection, setShowNodesSection] = useState<"structure" | "brands">("structure");
  const [showForm, setShowForm] = useState<"node" | null>(null);

  // Filter nodes by type
  const companyNodes = entities.filter((node) => node.type === "Company");
  const brandNodes = entities.filter((node) => node.type === "Brand");

  const selectedNode = entities.find((e) => e.id === context.selectedNodeId);
  const selectedEdge = edges.find((e) => e.id === context.selectedEdgeId);

  // Check if selected edge is node-node edge
  const entityIds = entities.map((e) => e.id);
  const isEntityEdge =
    selectedEdge &&
    (entityIds.includes(selectedEdge.sourceId) || entityIds.includes(selectedEdge.targetId));

  // Check if anything is selected (editing mode)
  const isEditing = selectedNode || selectedEdge || showForm !== null;

  return (
    <aside className="sidebar">
      {!isEditing && (
        <ScrollArea className="sidebar-scroll">
          <Accordion type="single" collapsible defaultValue="profile" className="sidebar-accordion">
            {/* Company Profile Accordion */}
            <AccordionItem value="profile" className="accordion-item">
              <AccordionTrigger className="accordion-trigger">Company Profile</AccordionTrigger>
              <AccordionContent className="accordion-content">
                <Tabs
                  value={showNodesSection}
                  onValueChange={(value) => setShowNodesSection(value as "structure" | "brands")}
                  className="sidebar-tabs"
                >
                  <TabsList className="tabs-list">
                    <TabsTrigger value="structure" className="tab-trigger">
                      🏢 Structure
                    </TabsTrigger>
                    <TabsTrigger value="brands" className="tab-trigger">
                      🏷️ Brands
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="structure" className="tabs-content">
                    {/* Structure Tools */}
                    <div className="section-header">
                      <span className="node-count">{companyNodes.length} nodes</span>
                      <div style={{ display: "flex" }}>
                        <button
                          className={`eye-toggle ${showNodes ? "active" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleNodes();
                          }}
                          title="Toggle nodes on graph"
                        >
                          {showNodes ? "👁️" : "👁️‍🗨️"}
                        </button>
                        <button
                          className="add-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowForm("node");
                          }}
                          title="Add company"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <NodeTree
                      nodes={companyNodes}
                      edges={edges}
                      context={context}
                      onFocusNode={onFocusNode}
                      onSelectNode={onSelectNode}
                    />
                  </TabsContent>

                  <TabsContent value="brands" className="tabs-content">
                    <div className="section-header">
                      <span className="node-count">{brandNodes.length} brands</span>
                      <div style={{ display: "flex" }}>
                        <button
                          className={`eye-toggle ${showBrands ? "active" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleBrands();
                          }}
                          title="Toggle brands on graph"
                        >
                          {showBrands ? "👁️" : "👁️‍🗨️"}
                        </button>
                        <button
                          className="add-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowForm("node");
                          }}
                          title="Add brand"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <NodeTree
                      nodes={brandNodes}
                      edges={edges}
                      context={context}
                      onFocusNode={onFocusNode}
                      onSelectNode={onSelectNode}
                    />
                  </TabsContent>
                </Tabs>
              </AccordionContent>
            </AccordionItem>

            {/* Financial Statements Accordion */}
            <AccordionItem value="financials" className="accordion-item">
              <AccordionTrigger className="accordion-trigger">
                Financial Statements
              </AccordionTrigger>
              <AccordionContent className="accordion-content">
                <div className="empty-message">
                  <p>Income Statement</p>
                  <p>Balance Sheet</p>
                  <p>Cash Flow</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ScrollArea>
      )}

      {/* Editing Panels */}
      {selectedNode && <NodePanel node={selectedNode} onCancel={() => onSelectNode?.(null)} />}
      {selectedEdge && (
        <EdgePanel
          edge={selectedEdge}
          isEntityEdge={!!isEntityEdge}
          onCancel={() => onSelectEdge?.(null)}
        />
      )}

      {/* Add Node Panel */}
      {showForm === "node" && <NodePanel onCancel={() => setShowForm(null)} mode="add" />}
    </aside>
  );
};

export default Sidebar;

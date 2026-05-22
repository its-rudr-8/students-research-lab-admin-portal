import React, { createContext, useContext, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type ConfirmFn = (opts?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null);

  const confirm: ConfirmFn = (options = {}) => {
    return new Promise<boolean>((resolve) => {
      setOpts(options);
      setResolver(() => resolve);
      setOpen(true);
    });
  };

  const handleClose = (result: boolean) => {
    setOpen(false);
    if (resolver) resolver(result);
    setResolver(null);
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(false); }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{opts?.title || "Confirm action"}</DialogTitle>
            <DialogDescription>{opts?.description || "Are you sure you want to continue?"}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>{opts?.cancelLabel || "Cancel"}</Button>
              <Button className="bg-destructive text-white" onClick={() => handleClose(true)}>{opts?.confirmLabel || "Confirm"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = (): ConfirmFn => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
};

export default ConfirmProvider;

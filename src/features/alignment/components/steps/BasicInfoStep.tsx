import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { stateNames } from "@/hooks/useStateData";

interface BasicInfoStepProps {
  data: {
    state: string;
    zip_code: string;
  };
  onUpdate: (data: Partial<{ state: string; zip_code: string }>) => void;
}

export function BasicInfoStep({ data, onUpdate }: BasicInfoStepProps) {
  const stateOptions = Object.entries(stateNames).map(([abbr, name]) => ({
    value: abbr,
    label: name,
  }));
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold text-foreground mb-2">
          Let's start with some basics
        </h2>
        <p className="text-muted-foreground">
          This helps us show you your representatives. We never store or ask about party affiliation.
        </p>
      </div>
      
      <div className="space-y-4 max-w-md">
        <div className="space-y-2">
          <Label htmlFor="zip">
            Zip Code <span className="text-destructive">*</span>
          </Label>
          <Input
            id="zip"
            type="text"
            placeholder="12345"
            value={data.zip_code}
            onChange={(e) => onUpdate({ zip_code: e.target.value })}
            maxLength={10}
          />
          <p className="text-xs text-muted-foreground">
            Used to identify your specific congressional district and senators
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="state">
            Your State <span className="text-destructive">*</span>
          </Label>
          <Select
            value={data.state}
            onValueChange={(value) => onUpdate({ state: value })}
          >
            <SelectTrigger id="state">
              <SelectValue placeholder="Select your state" />
            </SelectTrigger>
            <SelectContent>
              {stateOptions.map((state) => (
                <SelectItem key={state.value} value={state.value}>
                  {state.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Your 2 senators and House representative will be automatically tracked
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { Eye, Save, RotateCcw, FileText } from 'lucide-react';

interface NotificationTemplates {
  event_confirmation: {
    title: string;
    greeting: string;
    content: string;
  };
  payment_received: {
    title: string;
    greeting: string;
    content: string;
  };
  event_assignment: {
    title: string;
    greeting: string;
    content: string;
  };
  task_assignment: {
    title: string;
    greeting: string;
    content: string;
  };
  salary_payment: {
    title: string;
    greeting: string;
    content: string;
  };
  event_cancellation: {
    title: string;
    greeting: string;
    content: string;
  };
}

const defaultTemplates: NotificationTemplates = {
  event_confirmation: {
    title: 'EVENT CONFIRMED',
    greeting: 'Dear *{clientName}*,',
    content: 'Your event has been successfully confirmed:'
  },
  payment_received: {
    title: 'PAYMENT RECEIVED',
    greeting: 'Dear *{clientName}*,',
    content: 'We have successfully received your payment:'
  },
  event_assignment: {
    title: 'ASSIGNMENT',
    greeting: 'Dear *{staffName}*,',
    content: 'You are assigned as *{role}* for the following event:'
  },
  task_assignment: {
    title: 'TASK ASSIGNMENT',
    greeting: 'Dear *{staffName}*,',
    content: 'A new *{taskType}* task has been assigned to you:'
  },
  salary_payment: {
    title: 'PAYMENT PROCESSED',
    greeting: 'Dear *{staffName}*,',
    content: 'Your salary payment has been processed:'
  },
  event_cancellation: {
    title: 'EVENT CANCELLED',
    greeting: 'Dear *{clientName}*,',
    content: 'We wish to inform you that the following event has been cancelled:'
  }
};

const WhatsAppMessageTemplates = () => {
  const { currentFirmId } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<NotificationTemplates>(defaultTemplates);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewType, setPreviewType] = useState<keyof NotificationTemplates>('event_confirmation');
  const [brandingSettings, setBrandingSettings] = useState({
    firm_name: 'PRIT PHOTO',
    firm_tagline: '#aJourneyOfLoveByPritPhoto',
    contact_info: 'Contact: +91 72850 72603',
    footer_signature: 'Your memories, our passion'
  });

  useEffect(() => {
    loadTemplates();
  }, [currentFirmId]);

  const loadTemplates = async () => {
    if (!currentFirmId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('wa_sessions')
        .select('notification_templates, firm_name, firm_tagline, contact_info, footer_signature')
        .eq('firm_id', currentFirmId)
        .single();

      if (data) {
        if (data.notification_templates && 
            typeof data.notification_templates === 'object' && 
            !Array.isArray(data.notification_templates)) {
          try {
            const templatesData = data.notification_templates as any;
            if (templatesData.event_confirmation && templatesData.payment_received) {
              setTemplates(templatesData as NotificationTemplates);
            } else {
              setTemplates(defaultTemplates);
            }
          } catch (e) {
            setTemplates(defaultTemplates);
          }
        } else {
          setTemplates(defaultTemplates);
        }
        
        // Load branding for preview
        setBrandingSettings({
          firm_name: data.firm_name || 'PRIT PHOTO',
          firm_tagline: data.firm_tagline || '#aJourneyOfLoveByPritPhoto',
          contact_info: data.contact_info || 'Contact: +91 72850 72603',
          footer_signature: data.footer_signature || 'Your memories, our passion'
        });
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveTemplates = async () => {
    if (!currentFirmId) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('wa_sessions')
        .upsert({
          id: currentFirmId,
          firm_id: currentFirmId,
          notification_templates: templates as any
        });

      if (error) throw error;

      toast({
        title: "Templates Saved",
        description: "WhatsApp message templates have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving templates:', error);
      toast({
        title: "Error",
        description: "Failed to save message templates.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    setTemplates(defaultTemplates);
  };

  const generatePreview = (type: keyof NotificationTemplates) => {
    const template = templates[type];
    
    const sampleData = {
      event_confirmation: {
        clientName: 'John Doe',
        eventName: 'Wedding Photography',
        eventDate: '15/12/2024',
        venue: 'Grand Palace Hotel',
        totalAmount: 50000
      },
      payment_received: {
        clientName: 'John Doe',
        eventName: 'Wedding Photography',
        amountPaid: 25000,
        paymentMethod: 'Bank Transfer',
        remainingBalance: 25000
      },
      event_assignment: {
        staffName: 'Alex Johnson',
        role: 'PHOTOGRAPHER',
        eventName: 'Wedding Photography',
        eventDate: '15/12/2024',
        venue: 'Grand Palace Hotel'
      },
      task_assignment: {
        staffName: 'Alex Johnson',
        taskType: 'PHOTO EDITING',
        taskTitle: 'Edit wedding photos for John Doe',
        eventName: 'Wedding Photography'
      },
      salary_payment: {
        staffName: 'Alex Johnson',
        amount: 5000,
        paymentMethod: 'Bank Transfer',
        eventName: 'Wedding Photography'
      },
      event_cancellation: {
        clientName: 'John Doe',
        eventName: 'Wedding Photography',
        eventDate: '15/12/2024',
        venue: 'Grand Palace Hotel'
      }
    };

    const data = sampleData[type];
    let message = `*${template.title}*\n\n`;
    
    if (type.includes('client') || type === 'event_confirmation' || type === 'payment_received' || type === 'event_cancellation') {
      message += `${template.greeting.replace('{clientName}', (data as any).clientName)}\n\n`;
    } else {
      message += `${template.greeting.replace('{staffName}', (data as any).staffName)}\n\n`;
    }
    
    message += `${template.content}\n\n`;
    
    // Add sample details based on type
    switch (type) {
      case 'event_confirmation':
        message += `*Event:* ${(data as any).eventName}\n*Date:* ${(data as any).eventDate}\n*Venue:* ${(data as any).venue}\n*Amount:* ₹${(data as any).totalAmount.toLocaleString()}`;
        break;
      case 'payment_received':
        message += `*Event:* ${(data as any).eventName}\n*Amount Paid:* ₹${(data as any).amountPaid.toLocaleString()}\n*Payment Method:* ${(data as any).paymentMethod}\n*Remaining Balance:* ₹${(data as any).remainingBalance.toLocaleString()}`;
        break;
      case 'event_assignment':
        message += `*Event:* ${(data as any).eventName}\n*Date:* ${(data as any).eventDate}\n*Venue:* ${(data as any).venue}`;
        break;
      case 'task_assignment':
        message += `*Task:* ${(data as any).taskTitle}\n*Related Event:* ${(data as any).eventName}\n*Status:* Pending`;
        break;
      case 'salary_payment':
        message += `*Amount:* ₹${(data as any).amount.toLocaleString()}\n*Payment Method:* ${(data as any).paymentMethod}\n*Event:* ${(data as any).eventName}`;
        break;
      case 'event_cancellation':
        message += `*Event:* ${(data as any).eventName}\n*Date:* ${(data as any).eventDate}\n*Venue:* ${(data as any).venue}`;
        break;
    }
    
    message += `\n\nThank you for choosing *${brandingSettings.firm_name}*\n_${brandingSettings.firm_tagline}_\n${brandingSettings.contact_info}\n${brandingSettings.footer_signature}`;
    
    return message;
  };

  const hasChanges = JSON.stringify(templates) !== JSON.stringify(defaultTemplates);

  const templateDisplayNames = {
    event_confirmation: 'Event Confirmation',
    payment_received: 'Payment Received',
    event_assignment: 'Event Assignment',
    task_assignment: 'Task Assignment',
    salary_payment: 'Salary Payment',
    event_cancellation: 'Event Cancellation'
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-8">
            <div className="text-center text-muted-foreground">
              Loading message templates...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Templates */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="text-base font-medium">Notification Templates</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Message Preview</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Preview Type</Label>
                    <Select value={previewType} onValueChange={(value) => setPreviewType(value as keyof NotificationTemplates)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select template type" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(templateDisplayNames).map(([key, name]) => (
                          <SelectItem key={key} value={key}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="bg-muted p-4 rounded-lg border">
                    <pre className="whitespace-pre-wrap text-sm font-mono">
                      {generatePreview(previewType)}
                    </pre>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={resetToDefaults} className="w-full sm:w-auto">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button 
              size="sm" 
              onClick={saveTemplates} 
              disabled={isSaving || !hasChanges}
              className="w-full sm:w-auto"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {Object.entries(templates).map(([key, template]) => (
          <Card key={key}>
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              {templateDisplayNames[key as keyof typeof templateDisplayNames]}
            </CardTitle>
              <p className="text-sm text-muted-foreground">
                Message for {templateDisplayNames[key as keyof typeof templateDisplayNames].toLowerCase()}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={template.title}
                    onChange={(e) => setTemplates(prev => ({
                      ...prev,
                      [key]: { ...template, title: e.target.value }
                    }))}
                    placeholder="Notification Title"
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Greeting</Label>
                  <Input
                    value={template.greeting}
                    onChange={(e) => setTemplates(prev => ({
                      ...prev,
                      [key]: { ...template, greeting: e.target.value }
                    }))}
                    placeholder="Dear *{clientName}* or Dear *{staffName}*"
                    disabled={isSaving}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  value={template.content}
                  onChange={(e) => setTemplates(prev => ({
                    ...prev,
                    [key]: { ...template, content: e.target.value }
                  }))}
                  placeholder="Main message content"
                  rows={3}
                  disabled={isSaving}
                />
              </div>
              
              <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <strong>Available variables:</strong> {key.includes('client') || key === 'event_confirmation' || key === 'payment_received' || key === 'event_cancellation' 
                  ? '{clientName}' 
                  : '{staffName}, {role}, {taskType}'}
              </div>
            </CardContent>
          </Card>
        ))}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppMessageTemplates;
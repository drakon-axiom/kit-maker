import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Loader2, Trash2, ChevronDown, ChevronRight, Check, Upload, AlertCircle, Search } from 'lucide-react';
import { BundleFormFields } from '@/components/BundleFormFields';
import { CategoryManager } from '@/components/CategoryManager';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { SKUCard } from '@/components/mobile/SKUCard';

interface PricingTier {
  id?: string;
  min_quantity: number;
  max_quantity: number | null;
  price_per_kit: number;
}

interface SKU {
  id: string;
  code: string;
  description: string;
  label_required: boolean;
  price_per_kit: number;
  price_per_piece: number;
  active: boolean;
  use_tier_pricing: boolean;
  created_at: string;
  pricing_tiers?: PricingTier[];
  sizes?: Array<{ id: string; size_ml: number }>;
  category_id?: string | null;
  is_bundle: boolean;
  pack_size: number;
  bundle_product_price: number;
  bundle_packaging_price: number;
  bundle_labeling_price: number;
  bundle_inserts_price: number;
  bundle_labor_price?: number;
  bundle_overhead_price?: number;
  inserts_optional: boolean;
  categories?: { id: string; name: string };
  default_bottle_size_ml: number;
}

interface ImportRow {
  code: string;
  description: string;
  price_per_kit: string;
  price_per_piece: string;
  label_required: string;
  active: string;
  use_tier_pricing: string;
  sizes?: string;
  tier1_min?: string;
  tier1_max?: string;
  tier1_price?: string;
  tier2_min?: string;
  tier2_max?: string;
  tier2_price?: string;
  tier3_min?: string;
  tier3_max?: string;
  tier3_price?: string;
  tier4_min?: string;
  tier4_max?: string;
  tier4_price?: string;
  tier5_min?: string;
  tier5_max?: string;
  tier5_price?: string;
  errors?: string[];
  action?: 'create' | 'update';
  existingId?: string;
  tiers?: Array<{ min_quantity: number; max_quantity: number | null; price_per_kit: number }>;
  sizesArray?: number[];
}

const SKUs = () => {
  const [skus, setSKUs] = useState<SKU[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSKU, setEditingSKU] = useState<SKU | null>(null);
  const [selectedSKUs, setSelectedSKUs] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkFormData, setBulkFormData] = useState({
    active: true,
    label_required: false,
    price_per_piece: '',
    sizes: [] as number[],
    category_id: '',
  });
  const [importOpen, setImportOpen] = useState(false);
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [skuToDelete, setSKUToDelete] = useState<SKU | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    label_required: false,
    price_per_kit: '',
    price_per_piece: '',
    active: true,
    use_tier_pricing: false,
    sizes: [] as number[],
    category_id: '',
    is_bundle: false,
    pack_size: 1,
    bundle_product_price: '',
    bundle_packaging_price: '',
    bundle_labeling_price: '',
    bundle_inserts_price: '',
    bundle_labor_price: '',
    bundle_overhead_price: '',
    inserts_optional: true,
    default_bottle_size_ml: 10,
  });
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([
    { min_quantity: 5, max_quantity: 10, price_per_kit: 0 },
    { min_quantity: 11, max_quantity: 25, price_per_kit: 0 },
    { min_quantity: 26, max_quantity: 50, price_per_kit: 0 },
    { min_quantity: 51, max_quantity: 99, price_per_kit: 0 },
    { min_quantity: 100, max_quantity: null, price_per_kit: 0 },
  ]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [customSizeUnit, setCustomSizeUnit] = useState<'ml' | 'L'>('ml');
  const { toast } = useToast();

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      setCategories(data || []);
    } catch {
      // Category fetch errors are non-critical
    }
  }, []);

  const fetchSKUs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('skus')
        .select(`
          *,
          pricing_tiers:sku_pricing_tiers(*),
          sizes:sku_sizes(id, size_ml),
          categories(id, name)
        `)
        .order('code');

      if (error) throw error;
      const skusWithTiers = (data || []).map(sku => ({
        ...sku,
        pricing_tiers: sku.pricing_tiers?.sort((a: PricingTier, b: PricingTier) => a.min_quantity - b.min_quantity) || [],
        sizes: sku.sizes?.sort((a: any, b: any) => a.size_ml - b.size_ml) || []
      }));
      setSKUs(skusWithTiers);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSKUs();
    fetchCategories();
  }, [fetchSKUs, fetchCategories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        code: formData.code,
        description: formData.description,
        label_required: formData.label_required,
        price_per_kit: parseFloat(formData.price_per_kit),
        price_per_piece: parseFloat(formData.price_per_piece),
        active: formData.active,
        use_tier_pricing: formData.use_tier_pricing,
        category_id: formData.category_id || null,
        is_bundle: formData.is_bundle,
        pack_size: formData.pack_size,
        bundle_product_price: parseFloat(formData.bundle_product_price) || 0,
        bundle_packaging_price: parseFloat(formData.bundle_packaging_price) || 0,
        bundle_labeling_price: parseFloat(formData.bundle_labeling_price) || 0,
        bundle_inserts_price: parseFloat(formData.bundle_inserts_price) || 0,
        bundle_labor_price: parseFloat(formData.bundle_labor_price) || 0,
        bundle_overhead_price: parseFloat(formData.bundle_overhead_price) || 0,
        inserts_optional: formData.inserts_optional,
        default_bottle_size_ml: formData.default_bottle_size_ml,
      };

      let skuId = editingSKU?.id;

      if (editingSKU) {
        const { error } = await supabase
          .from('skus')
          .update(payload)
          .eq('id', editingSKU.id);

        if (error) throw error;

        // Delete existing tiers and sizes
        await supabase
          .from('sku_pricing_tiers')
          .delete()
          .eq('sku_id', editingSKU.id);
        
        await supabase
          .from('sku_sizes')
          .delete()
          .eq('sku_id', editingSKU.id);
        
        skuId = editingSKU.id;
      } else {
        const { data, error } = await supabase
          .from('skus')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        skuId = data.id;
      }

      // Insert sizes
      if (formData.sizes.length > 0) {
        const sizeInserts = formData.sizes.map(size => ({
          sku_id: skuId,
          size_ml: size,
        }));

        const { error: sizesError } = await supabase
          .from('sku_sizes')
          .insert(sizeInserts);

        if (sizesError) throw sizesError;
      }

      // Insert pricing tiers only if tier pricing is enabled
      if (formData.use_tier_pricing) {
        const tierInserts = pricingTiers.map(tier => ({
          sku_id: skuId,
          min_quantity: tier.min_quantity,
          max_quantity: tier.max_quantity,
          price_per_kit: tier.price_per_kit,
        }));

        const { error: tiersError } = await supabase
          .from('sku_pricing_tiers')
          .insert(tierInserts);

        if (tiersError) throw tiersError;
      }

      toast({ 
        title: 'Success', 
        description: editingSKU ? 'SKU updated successfully' : 'SKU created successfully' 
      });

      setDialogOpen(false);
      resetForm();
      fetchSKUs();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedSKUs.size === 0) {
      toast({
        title: 'No SKUs selected',
        description: 'Please select at least one SKU to update',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      const updates: any = {
        active: bulkFormData.active,
        label_required: bulkFormData.label_required,
      };

      if (bulkFormData.price_per_piece) {
        updates.price_per_piece = parseFloat(bulkFormData.price_per_piece);
      }

      if (bulkFormData.category_id) {
        updates.category_id = bulkFormData.category_id === 'none' ? null : bulkFormData.category_id;
      }

      const updatePromises = Array.from(selectedSKUs).map(skuId =>
        supabase.from('skus').update(updates).eq('id', skuId)
      );

      const results = await Promise.all(updatePromises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} SKU(s)`);
      }

      // Handle size variants if specified
      if (bulkFormData.sizes.length > 0) {
        const sizePromises = Array.from(selectedSKUs).flatMap(async (skuId) => {
          // Delete existing sizes
          await supabase.from('sku_sizes').delete().eq('sku_id', skuId);
          
          // Insert new sizes
          const sizeInserts = bulkFormData.sizes.map(size => ({
            sku_id: skuId,
            size_ml: size,
          }));
          
          return supabase.from('sku_sizes').insert(sizeInserts);
        });
        
        await Promise.all(sizePromises);
      }

      toast({
        title: 'Success',
        description: `Updated ${selectedSKUs.size} SKU(s) successfully`,
      });

      setBulkEditOpen(false);
      setSelectedSKUs(new Set());
      setBulkFormData({
        active: true,
        label_required: false,
        price_per_piece: '',
        sizes: [],
        category_id: '',
      });
      fetchSKUs();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleSelectSKU = (skuId: string) => {
    const newSelected = new Set(selectedSKUs);
    if (newSelected.has(skuId)) {
      newSelected.delete(skuId);
    } else {
      newSelected.add(skuId);
    }
    setSelectedSKUs(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedSKUs.size === skus.length) {
      setSelectedSKUs(new Set());
    } else {
      setSelectedSKUs(new Set(skus.map(s => s.id)));
    }
  };

  const validateImportRow = (row: any, index: number): ImportRow => {
    const errors: string[] = [];
    const tiers: Array<{ min_quantity: number; max_quantity: number | null; price_per_kit: number }> = [];
    const sizesArray: number[] = [];
    
    if (!row.code || row.code.trim() === '') {
      errors.push('Code is required');
    }
    
    if (!row.description || row.description.trim() === '') {
      errors.push('Description is required');
    }

    // Validate sizes
    if (row.sizes) {
      const sizeStr = row.sizes.toString().trim();
      if (sizeStr) {
        const sizes = sizeStr.split(',').map((s: string) => parseInt(s.trim()));
        for (const size of sizes) {
          if (isNaN(size) || size < 1 || size > 10000) {
            errors.push(`Invalid size: ${size}. Must be between 1 and 10000 ml`);
          } else {
            sizesArray.push(size);
          }
        }
      }
    }
    
    const useTierPricing = ['true', 'yes', '1'].includes(row.use_tier_pricing?.toString().toLowerCase());
    
    if (!useTierPricing) {
      const pricePerKit = parseFloat(row.price_per_kit);
      if (isNaN(pricePerKit) || pricePerKit < 0) {
        errors.push('Price per kit must be a valid positive number');
      }
    }
    
    const pricePerPiece = parseFloat(row.price_per_piece);
    if (isNaN(pricePerPiece) || pricePerPiece < 0) {
      errors.push('Price per piece must be a valid positive number');
    }
    
    const labelRequired = row.label_required?.toString().toLowerCase();
    if (labelRequired && !['true', 'false', 'yes', 'no', '1', '0', ''].includes(labelRequired)) {
      errors.push('Label required must be true/false, yes/no, or 1/0');
    }
    
    const active = row.active?.toString().toLowerCase();
    if (active && !['true', 'false', 'yes', 'no', '1', '0', ''].includes(active)) {
      errors.push('Active must be true/false, yes/no, or 1/0');
    }

    // Validate pricing tiers if use_tier_pricing is true
    if (useTierPricing) {
      for (let i = 1; i <= 5; i++) {
        const minKey = `tier${i}_min` as keyof typeof row;
        const maxKey = `tier${i}_max` as keyof typeof row;
        const priceKey = `tier${i}_price` as keyof typeof row;
        
        const minQty = row[minKey];
        const maxQty = row[maxKey];
        const price = row[priceKey];
        
        // If any tier field is provided, validate all three
        if (minQty || maxQty || price) {
          const min = parseInt(minQty);
          const max = maxQty ? parseInt(maxQty) : null;
          const tierPrice = parseFloat(price);
          
          if (isNaN(min) || min < 1) {
            errors.push(`Tier ${i}: min quantity must be a positive number`);
          }
          
          if (maxQty && (isNaN(max!) || max! < min)) {
            errors.push(`Tier ${i}: max quantity must be greater than min quantity`);
          }
          
          if (isNaN(tierPrice) || tierPrice < 0) {
            errors.push(`Tier ${i}: price must be a valid positive number`);
          }
          
          if (!errors.some(e => e.startsWith(`Tier ${i}:`))) {
            tiers.push({
              min_quantity: min,
              max_quantity: max,
              price_per_kit: tierPrice,
            });
          }
        }
      }
      
      if (tiers.length === 0) {
        errors.push('At least one pricing tier is required when use_tier_pricing is true');
      }
    }
    
    return {
      code: row.code || '',
      description: row.description || '',
      price_per_kit: row.price_per_kit || '',
      price_per_piece: row.price_per_piece || '',
      label_required: row.label_required || 'false',
      active: row.active || 'true',
      use_tier_pricing: row.use_tier_pricing || 'false',
      sizes: row.sizes || '',
      tier1_min: row.tier1_min || '',
      tier1_max: row.tier1_max || '',
      tier1_price: row.tier1_price || '',
      tier2_min: row.tier2_min || '',
      tier2_max: row.tier2_max || '',
      tier2_price: row.tier2_price || '',
      tier3_min: row.tier3_min || '',
      tier3_max: row.tier3_max || '',
      tier3_price: row.tier3_price || '',
      tier4_min: row.tier4_min || '',
      tier4_max: row.tier4_max || '',
      tier4_price: row.tier4_price || '',
      tier5_min: row.tier5_min || '',
      tier5_max: row.tier5_max || '',
      tier5_price: row.tier5_price || '',
      tiers: tiers.length > 0 ? tiers : undefined,
      sizesArray: sizesArray.length > 0 ? sizesArray : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  };

  const checkExistingSKUs = async (rows: ImportRow[]) => {
    try {
      const { data: existingSKUs, error } = await supabase
        .from('skus')
        .select('id, code');

      if (error) throw error;

      const existingCodesMap = new Map(
        existingSKUs?.map(sku => [sku.code.toLowerCase(), sku.id]) || []
      );

      return rows.map(row => {
        const existingId = existingCodesMap.get(row.code.trim().toLowerCase());
        return {
          ...row,
          action: existingId ? 'update' as const : 'create' as const,
          existingId,
        };
      });
    } catch (error) {
      toast({
        title: 'Error checking existing SKUs',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      return rows;
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    const processData = async (data: any[]) => {
      const validatedData = data.map((row, index) => validateImportRow(row, index));
      const dataWithActions = await checkExistingSKUs(validatedData);
      setImportData(dataWithActions);
    };

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          await processData(results.data);
        },
        error: (error) => {
          toast({
            title: 'Error parsing CSV',
            description: error instanceof Error ? error.message : 'An error occurred',
            variant: 'destructive',
          });
        },
      });
    } else if (['xlsx', 'xls'].includes(fileExtension || '')) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          await processData(jsonData);
        } catch (error) {
          toast({
            title: 'Error parsing Excel file',
            description: error instanceof Error ? error.message : 'An error occurred',
            variant: 'destructive',
          });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast({
        title: 'Invalid file format',
        description: 'Please upload a CSV or Excel file',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async () => {
    const validRows = importData.filter(row => !row.errors);
    
    if (validRows.length === 0) {
      toast({
        title: 'No valid rows',
        description: 'Please fix all errors before importing',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);

    try {
      const toInsert: any[] = [];
      const toUpdate: any[] = [];

      validRows.forEach(row => {
        const useTierPricing = ['true', 'yes', '1'].includes(row.use_tier_pricing.toLowerCase());
        
        const skuData = {
          code: row.code.trim(),
          description: row.description.trim(),
          price_per_kit: useTierPricing ? 0 : parseFloat(row.price_per_kit),
          price_per_piece: parseFloat(row.price_per_piece),
          label_required: ['true', 'yes', '1'].includes(row.label_required.toLowerCase()),
          active: ['true', 'yes', '1'].includes(row.active.toLowerCase()) || row.active === '',
          use_tier_pricing: useTierPricing,
        };

        if (row.action === 'update' && row.existingId) {
          toUpdate.push({ id: row.existingId, ...skuData, tiers: row.tiers, sizes: row.sizesArray });
        } else {
          toInsert.push({ ...skuData, tiers: row.tiers, sizes: row.sizesArray });
        }
      });

      // Perform inserts for new SKUs
      if (toInsert.length > 0) {
        for (const sku of toInsert) {
          const { tiers, sizes, ...skuData } = sku;
          
          const { data: newSKU, error: insertError } = await supabase
            .from('skus')
            .insert([skuData])
            .select()
            .single();

          if (insertError) throw insertError;

          // Insert sizes
          if (sizes && sizes.length > 0) {
            const sizeInserts = sizes.map((size: number) => ({
              sku_id: newSKU.id,
              size_ml: size,
            }));

            const { error: sizesError } = await supabase
              .from('sku_sizes')
              .insert(sizeInserts);

            if (sizesError) throw sizesError;
          }

          // Insert pricing tiers if provided
          if (tiers && tiers.length > 0) {
            const tierInserts = tiers.map((tier: any) => ({
              sku_id: newSKU.id,
              ...tier,
            }));

            const { error: tiersError } = await supabase
              .from('sku_pricing_tiers')
              .insert(tierInserts);

            if (tiersError) throw tiersError;
          }
        }
      }

      // Perform updates for existing SKUs
      for (const sku of toUpdate) {
        const { id, tiers, sizes, ...updateData } = sku;
        
        const { error: updateError } = await supabase
          .from('skus')
          .update(updateData)
          .eq('id', id);

        if (updateError) throw updateError;

        // Delete existing tiers and sizes
        await supabase
          .from('sku_pricing_tiers')
          .delete()
          .eq('sku_id', id);

        await supabase
          .from('sku_sizes')
          .delete()
          .eq('sku_id', id);

        // Insert new sizes
        if (sizes && sizes.length > 0) {
          const sizeInserts = sizes.map((size: number) => ({
            sku_id: id,
            size_ml: size,
          }));

          const { error: sizesError } = await supabase
            .from('sku_sizes')
            .insert(sizeInserts);

          if (sizesError) throw sizesError;
        }

        // Insert new tiers
        if (tiers && tiers.length > 0) {
          const tierInserts = tiers.map((tier: any) => ({
            sku_id: id,
            ...tier,
          }));

          const { error: tiersError } = await supabase
            .from('sku_pricing_tiers')
            .insert(tierInserts);

          if (tiersError) throw tiersError;
        }
      }

      toast({
        title: 'Success',
        description: `Created ${toInsert.length} new SKU(s), updated ${toUpdate.length} existing SKU(s)`,
      });

      setImportOpen(false);
      setImportData([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      fetchSKUs();
    } catch (error) {
      toast({
        title: 'Error importing SKUs',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        code: 'EXAMPLE-001',
        description: 'Example Product with Standard Pricing',
        sizes: '10,20,30',
        price_per_kit: '25.00',
        price_per_piece: '2.50',
        label_required: 'false',
        active: 'true',
        use_tier_pricing: 'false',
        tier1_min: '',
        tier1_max: '',
        tier1_price: '',
        tier2_min: '',
        tier2_max: '',
        tier2_price: '',
        tier3_min: '',
        tier3_max: '',
        tier3_price: '',
        tier4_min: '',
        tier4_max: '',
        tier4_price: '',
        tier5_min: '',
        tier5_max: '',
        tier5_price: '',
      },
      {
        code: 'EXAMPLE-002',
        description: 'Example Product with Tier Pricing',
        sizes: '50,100',
        price_per_kit: '0',
        price_per_piece: '2.50',
        label_required: 'true',
        active: 'true',
        use_tier_pricing: 'true',
        tier1_min: '5',
        tier1_max: '10',
        tier1_price: '20.00',
        tier2_min: '11',
        tier2_max: '25',
        tier2_price: '18.00',
        tier3_min: '26',
        tier3_max: '50',
        tier3_price: '16.00',
        tier4_min: '51',
        tier4_max: '99',
        tier4_price: '14.00',
        tier5_min: '100',
        tier5_max: '',
        tier5_price: '12.00',
      }
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sku_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      label_required: false,
      price_per_kit: '',
      price_per_piece: '',
      active: true,
      use_tier_pricing: false,
      sizes: [],
      category_id: '',
      is_bundle: false,
      pack_size: 1,
      bundle_product_price: '',
      bundle_packaging_price: '',
      bundle_labeling_price: '',
      bundle_inserts_price: '',
      bundle_labor_price: '',
      bundle_overhead_price: '',
      inserts_optional: true,
      default_bottle_size_ml: 10,
    });
    setPricingTiers([
      { min_quantity: 5, max_quantity: 10, price_per_kit: 0 },
      { min_quantity: 11, max_quantity: 25, price_per_kit: 0 },
      { min_quantity: 26, max_quantity: 50, price_per_kit: 0 },
      { min_quantity: 51, max_quantity: 99, price_per_kit: 0 },
      { min_quantity: 100, max_quantity: null, price_per_kit: 0 },
    ]);
    setEditingSKU(null);
  };

  const openEditDialog = (sku: SKU) => {
    setEditingSKU(sku);
    setFormData({
      code: sku.code,
      description: sku.description,
      label_required: sku.label_required,
      price_per_kit: sku.price_per_kit.toString(),
      price_per_piece: sku.price_per_piece.toString(),
      active: sku.active,
      use_tier_pricing: sku.use_tier_pricing,
      sizes: sku.sizes?.map(s => s.size_ml) || [],
      category_id: sku.category_id || '',
      is_bundle: sku.is_bundle,
      pack_size: sku.pack_size,
      bundle_product_price: sku.bundle_product_price.toString(),
      bundle_packaging_price: sku.bundle_packaging_price.toString(),
      bundle_labeling_price: sku.bundle_labeling_price.toString(),
      bundle_inserts_price: sku.bundle_inserts_price.toString(),
      bundle_labor_price: sku.bundle_labor_price?.toString() || '',
      bundle_overhead_price: sku.bundle_overhead_price?.toString() || '',
      inserts_optional: sku.inserts_optional,
      default_bottle_size_ml: sku.default_bottle_size_ml || 10,
    });
    
    // Load pricing tiers or use defaults
    if (sku.pricing_tiers && sku.pricing_tiers.length > 0) {
      setPricingTiers(sku.pricing_tiers.map(t => ({
        id: t.id,
        min_quantity: t.min_quantity,
        max_quantity: t.max_quantity,
        price_per_kit: t.price_per_kit
      })));
    } else {
      // Reset to defaults if no tiers
      setPricingTiers([
        { min_quantity: 5, max_quantity: 10, price_per_kit: 0 },
        { min_quantity: 11, max_quantity: 25, price_per_kit: 0 },
        { min_quantity: 26, max_quantity: 50, price_per_kit: 0 },
        { min_quantity: 51, max_quantity: 99, price_per_kit: 0 },
        { min_quantity: 100, max_quantity: null, price_per_kit: 0 },
      ]);
    }
    
    setDialogOpen(true);
  };

  const toggleSize = (size: number) => {
    const newSizes = formData.sizes.includes(size)
      ? formData.sizes.filter(s => s !== size)
      : [...formData.sizes, size].sort((a, b) => a - b);
    setFormData({ ...formData, sizes: newSizes });
  };

  const updateTier = (index: number, field: keyof PricingTier, value: any) => {
    const newTiers = [...pricingTiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setPricingTiers(newTiers);
  };

  const addTier = () => {
    const lastTier = pricingTiers[pricingTiers.length - 1];
    const newMin = lastTier.max_quantity ? lastTier.max_quantity + 1 : 100;
    setPricingTiers([...pricingTiers, {
      min_quantity: newMin,
      max_quantity: newMin + 10,
      price_per_kit: 0
    }]);
  };

  const removeTier = (index: number) => {
    setPricingTiers(pricingTiers.filter((_, i) => i !== index));
  };

  const toggleRow = (skuId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(skuId)) {
      newExpanded.delete(skuId);
    } else {
      newExpanded.add(skuId);
    }
    setExpandedRows(newExpanded);
  };

  const filteredSKUs = skus.filter(sku => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      sku.code.toLowerCase().includes(query) ||
      sku.description.toLowerCase().includes(query) ||
      sku.sizes?.some(s => s.size_ml.toString().includes(query))
    );
  });

  const handleDelete = async () => {
    if (!skuToDelete) return;

    try {
      // Delete related pricing tiers and sizes first (cascading delete should handle this, but being explicit)
      await supabase.from('sku_pricing_tiers').delete().eq('sku_id', skuToDelete.id);
      await supabase.from('sku_sizes').delete().eq('sku_id', skuToDelete.id);
      
      const { error } = await supabase
        .from('skus')
        .delete()
        .eq('id', skuToDelete.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'SKU deleted successfully',
      });

      fetchSKUs();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setSKUToDelete(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <CategoryManager />
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Products (SKUs)</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Manage your product catalog</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {selectedSKUs.size > 0 && (
            <Button variant="outline" size="sm" onClick={() => setBulkEditOpen(true)} className="flex-1 sm:flex-none">
              <Check className="mr-2 h-4 w-4" />
              Edit ({selectedSKUs.size})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="flex-1 sm:flex-none">
            <Upload className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex-1 sm:flex-none">
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Add SKU</span>
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSKU ? 'Edit SKU' : 'Add New SKU'}</DialogTitle>
              <DialogDescription>
                {editingSKU ? 'Update product information' : 'Add a new product to your catalog'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">SKU Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g., PROD-001"
                    required
                  />
                </div>
                <div className="space-y-2 flex items-end">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="active"
                      checked={formData.active}
                      onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                    />
                    <Label htmlFor="active">Active</Label>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Product description"
                  required
                />
              </div>
              
              <BundleFormFields
                isBundle={formData.is_bundle}
                packSize={formData.pack_size}
                bundleProductPrice={formData.bundle_product_price}
                bundlePackagingPrice={formData.bundle_packaging_price}
                bundleLabelingPrice={formData.bundle_labeling_price}
                bundleInsertsPrice={formData.bundle_inserts_price}
                bundleLaborPrice={formData.bundle_labor_price}
                bundleOverheadPrice={formData.bundle_overhead_price}
                insertsOptional={formData.inserts_optional}
                pricePerKit={formData.price_per_kit}
                onChange={(field, value) => setFormData({ ...formData, [field]: value })}
              />
              
              <div className="space-y-2">
                <Label htmlFor="category_id">Category (Optional)</Label>
                <Select value={formData.category_id || undefined} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="No category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Size Variants (ml)</Label>
                <div className="grid grid-cols-5 gap-2">
                  {[3, 5, 10, 20, 30, 50, 100, 500, 1000, 2000].map((size) => (
                    <div key={size} className="flex items-center space-x-2">
                      <Checkbox
                        id={`size-${size}`}
                        checked={formData.sizes.includes(size)}
                        onCheckedChange={() => toggleSize(size)}
                      />
                      <Label htmlFor={`size-${size}`} className="cursor-pointer">
                        {size >= 1000 ? `${size / 1000}L` : `${size}ml`}
                      </Label>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="number"
                    placeholder={`Custom size (${customSizeUnit})`}
                    value={customSizeInput}
                    onChange={(e) => setCustomSizeInput(e.target.value)}
                    className="w-28"
                    min={customSizeUnit === 'L' ? '0.001' : '1'}
                    max={customSizeUnit === 'L' ? '10' : '10000'}
                    step={customSizeUnit === 'L' ? '0.1' : '1'}
                  />
                  <div className="flex border rounded-md overflow-hidden">
                    <Button
                      type="button"
                      variant={customSizeUnit === 'ml' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-none px-3 h-9"
                      onClick={() => setCustomSizeUnit('ml')}
                    >
                      ml
                    </Button>
                    <Button
                      type="button"
                      variant={customSizeUnit === 'L' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-none px-3 h-9"
                      onClick={() => setCustomSizeUnit('L')}
                    >
                      L
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const inputValue = parseFloat(customSizeInput);
                      if (isNaN(inputValue) || inputValue <= 0) {
                        toast({
                          title: 'Invalid size',
                          description: 'Please enter a valid positive number',
                          variant: 'destructive',
                        });
                        return;
                      }
                      // Convert to ml for storage
                      const sizeInMl = customSizeUnit === 'L' ? Math.round(inputValue * 1000) : Math.round(inputValue);
                      if (sizeInMl < 1 || sizeInMl > 10000) {
                        toast({
                          title: 'Invalid size',
                          description: 'Size must be between 1ml and 10L',
                          variant: 'destructive',
                        });
                        return;
                      }
                      if (!formData.sizes.includes(sizeInMl)) {
                        setFormData({
                          ...formData,
                          sizes: [...formData.sizes, sizeInMl].sort((a, b) => a - b),
                        });
                      }
                      setCustomSizeInput('');
                    }}
                  >
                    Add
                  </Button>
                </div>
                {formData.sizes.filter(s => ![3, 5, 10, 20, 30, 50, 100, 500, 1000, 2000].includes(s)).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-xs text-muted-foreground">Custom:</span>
                    {formData.sizes.filter(s => ![3, 5, 10, 20, 30, 50, 100, 500, 1000, 2000].includes(s)).map(size => (
                      <Badge key={size} variant="secondary" className="text-xs cursor-pointer" onClick={() => toggleSize(size)}>
                        {size >= 1000 ? `${size / 1000}L` : `${size}ml`} ×
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Select preset sizes or add custom sizes
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_bottle_size_ml">Default Bottle Size (ml)</Label>
                <Select
                  value={formData.default_bottle_size_ml.toString()}
                  onValueChange={(value) => setFormData({ ...formData, default_bottle_size_ml: parseInt(value) })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="3">3ml</SelectItem>
                    <SelectItem value="5">5ml</SelectItem>
                    <SelectItem value="10">10ml</SelectItem>
                    <SelectItem value="20">20ml</SelectItem>
                    <SelectItem value="30">30ml</SelectItem>
                    <SelectItem value="50">50ml</SelectItem>
                    <SelectItem value="100">100ml</SelectItem>
                    <SelectItem value="500">500ml</SelectItem>
                    <SelectItem value="1000">1L (1000ml)</SelectItem>
                    <SelectItem value="2000">2L (2000ml)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Used for volume calculations in internal orders
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {!formData.use_tier_pricing && (
                  <div className="space-y-2">
                    <Label htmlFor="price_per_kit">Price per Kit ($) *</Label>
                    <Input
                      id="price_per_kit"
                      type="number"
                      step="0.01"
                      value={formData.price_per_kit}
                      onChange={(e) => setFormData({ ...formData, price_per_kit: e.target.value })}
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="price_per_piece">Price per Piece ($) *</Label>
                  <Input
                    id="price_per_piece"
                    type="number"
                    step="0.01"
                    value={formData.price_per_piece}
                    onChange={(e) => setFormData({ ...formData, price_per_piece: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="use_tier_pricing">Use Tier Pricing</Label>
                  <Switch
                    id="use_tier_pricing"
                    checked={formData.use_tier_pricing}
                    onCheckedChange={(checked) => setFormData({ ...formData, use_tier_pricing: checked })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enable quantity-based pricing tiers for bulk orders
                </p>
              </div>
              
              {formData.use_tier_pricing && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Kit Pricing Tiers *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addTier}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Tier
                  </Button>
                </div>
                <div className="space-y-2">
                  {pricingTiers.map((tier, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">Min Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={tier.min_quantity}
                          onChange={(e) => updateTier(index, 'min_quantity', parseInt(e.target.value) || 0)}
                          required
                        />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">Max Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Unlimited"
                          value={tier.max_quantity || ''}
                          onChange={(e) => updateTier(index, 'max_quantity', e.target.value ? parseInt(e.target.value) : null)}
                        />
                      </div>
                      <div className="col-span-5 space-y-1">
                        <Label className="text-xs">Price per Kit ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tier.price_per_kit}
                          onChange={(e) => updateTier(index, 'price_per_kit', parseFloat(e.target.value) || 0)}
                          required
                        />
                      </div>
                      <div className="col-span-1">
                        {pricingTiers.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTier(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}
              <div className="flex items-center space-x-2">
                <Switch
                  id="label_required"
                  checked={formData.label_required}
                  onCheckedChange={(checked) => setFormData({ ...formData, label_required: checked })}
                />
                <Label htmlFor="label_required">Label Required</Label>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingSKU ? 'Update' : 'Create'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg md:text-xl">All Products</CardTitle>
              <CardDescription className="text-xs md:text-sm">
                {filteredSKUs.length} of {skus.length} products
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 md:p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : skus.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm md:text-base">
              No products yet. Tap "Add SKU" to get started.
            </div>
          ) : filteredSKUs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm md:text-base">
              No products match "{searchQuery}"
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden p-2">
                {filteredSKUs.map((sku) => (
                  <SKUCard
                    key={sku.id}
                    sku={sku}
                    selected={selectedSKUs.has(sku.id)}
                    expanded={expandedRows.has(sku.id)}
                    onSelect={toggleSelectSKU}
                    onToggleExpand={toggleRow}
                    onEdit={openEditDialog}
                    onDelete={(s) => {
                      setSKUToDelete(s);
                      setDeleteDialogOpen(true);
                    }}
                  />
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
              <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedSKUs.size === skus.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Sizes</TableHead>
                  <TableHead>Piece Price</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSKUs.map((sku) => (
                  <>
                    <TableRow key={sku.id} className="cursor-pointer" onClick={() => toggleRow(sku.id)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedSKUs.has(sku.id)}
                          onCheckedChange={() => toggleSelectSKU(sku.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          {expandedRows.has(sku.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-mono font-medium">{sku.code}</TableCell>
                      <TableCell className="max-w-xs truncate">{sku.description}</TableCell>
                      <TableCell>
                        {sku.sizes && sku.sizes.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {sku.sizes.map((size) => (
                              <Badge key={size.id} variant="outline" className="text-xs">
                                {size.size_ml >= 1000 ? `${size.size_ml / 1000}L` : `${size.size_ml}ml`}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">No sizes</span>
                        )}
                      </TableCell>
                      <TableCell>${sku.price_per_piece.toFixed(2)}</TableCell>
                      <TableCell>
                        {sku.label_required ? (
                          <Badge variant="secondary">Required</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {sku.active ? (
                          <Badge className="bg-success">Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(sku)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSKUToDelete(sku);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(sku.id) && (
                      <TableRow>
                        <TableCell colSpan={9} className="bg-muted/50">
                          <div className="py-2 px-4">
                            {sku.use_tier_pricing ? (
                              <>
                                <div className="text-sm font-semibold mb-2">Kit Pricing Tiers:</div>
                                <div className="grid grid-cols-4 gap-4">
                                  {sku.pricing_tiers && sku.pricing_tiers.length > 0 ? (
                                    sku.pricing_tiers.map((tier, idx) => (
                                      <div key={idx} className="bg-background p-3 rounded-md border">
                                        <div className="text-xs text-muted-foreground mb-1">
                                          {tier.min_quantity} - {tier.max_quantity || '∞'} kits
                                        </div>
                                        <div className="text-lg font-semibold">
                                          ${tier.price_per_kit.toFixed(2)}
                                        </div>
                                        <div className="text-xs text-muted-foreground">per kit</div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-sm text-muted-foreground">No pricing tiers configured</div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                Standard pricing: ${sku.price_per_kit.toFixed(2)} per kit (no tiers)
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => {
        setImportOpen(open);
        if (!open) {
          setImportData([]);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import SKUs from File</DialogTitle>
            <DialogDescription>
              Upload a CSV or Excel file to bulk import products
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Required Format</AlertTitle>
              <AlertDescription className="space-y-2">
                <div>
                  <strong>Required columns:</strong> code, description, sizes, price_per_piece, label_required, active, use_tier_pricing
                </div>
                <div>
                  <strong>Sizes:</strong> Comma-separated list of sizes (e.g., "10,20,30" for 10ml, 20ml, and 30ml variants)
                </div>
                <div>
                  <strong>Standard pricing:</strong> Set use_tier_pricing=false and provide price_per_kit
                </div>
                <div>
                  <strong>Tier pricing:</strong> Set use_tier_pricing=true and fill tier columns (tier1_min, tier1_max, tier1_price, etc.)
                </div>
                <div className="text-xs text-muted-foreground">
                  Leave tier max empty for unlimited. Download template for examples.
                </div>
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="flex-1"
              />
              <Button variant="outline" onClick={downloadTemplate}>
                Download Template
              </Button>
            </div>

            {importData.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-sm space-y-1">
                    <div className="font-medium">Import Preview:</div>
                    <div className="text-muted-foreground">
                      {importData.filter(r => !r.errors && r.action === 'create').length} will be created • {' '}
                      {importData.filter(r => !r.errors && r.action === 'update').length} will be updated • {' '}
                      {importData.filter(r => r.errors).length} with errors
                    </div>
                  </div>
                </div>

                <div className="border rounded-md max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Kit Price</TableHead>
                        <TableHead>Piece Price</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead>Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importData.map((row, index) => (
                        <TableRow key={index} className={row.errors ? 'bg-destructive/10' : ''}>
                          <TableCell>
                            {row.errors ? (
                              <Badge variant="destructive">Error</Badge>
                            ) : (
                              <Badge className="bg-success">Valid</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {!row.errors && (
                              <Badge variant={row.action === 'create' ? 'default' : 'secondary'}>
                                {row.action === 'create' ? 'Create' : 'Update'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono">{row.code}</TableCell>
                          <TableCell className="max-w-xs truncate">{row.description}</TableCell>
                          <TableCell>${row.price_per_kit}</TableCell>
                          <TableCell>${row.price_per_piece}</TableCell>
                          <TableCell>{row.label_required}</TableCell>
                          <TableCell>{row.active}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {importData.some(r => r.errors) && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Validation Errors</AlertTitle>
                    <AlertDescription>
                      <div className="mt-2 space-y-1">
                        {importData.map((row, index) => 
                          row.errors?.map((error, errIdx) => (
                            <div key={`${index}-${errIdx}`} className="text-sm">
                              Row {index + 1}: {error}
                            </div>
                          ))
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleImport} 
                    disabled={importing || importData.filter(r => !r.errors).length === 0}
                  >
                    {importing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      `Import ${importData.filter(r => !r.errors).length} SKU(s)`
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Edit SKUs</DialogTitle>
            <DialogDescription>
              Update {selectedSKUs.size} selected SKU(s) at once
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="bulk_active">Active Status</Label>
              <Switch
                id="bulk_active"
                checked={bulkFormData.active}
                onCheckedChange={(checked) => setBulkFormData({ ...bulkFormData, active: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="bulk_label">Label Required</Label>
              <Switch
                id="bulk_label"
                checked={bulkFormData.label_required}
                onCheckedChange={(checked) => setBulkFormData({ ...bulkFormData, label_required: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk_price">Price per Piece ($)</Label>
              <Input
                id="bulk_price"
                type="number"
                step="0.01"
                placeholder="Leave empty to keep existing prices"
                value={bulkFormData.price_per_piece}
                onChange={(e) => setBulkFormData({ ...bulkFormData, price_per_piece: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to keep existing prices unchanged
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk_category">Category</Label>
              <Select
                value={bulkFormData.category_id}
                onValueChange={(value) => setBulkFormData({ ...bulkFormData, category_id: value })}
              >
                <SelectTrigger id="bulk_category">
                  <SelectValue placeholder="Leave unchanged" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Leave unchanged</SelectItem>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leave unchanged to keep existing categories
              </p>
            </div>
            <div className="space-y-2">
              <Label>Size Variants (ml)</Label>
              <div className="flex flex-wrap gap-2">
                {[3, 5, 10, 20, 30, 50, 100, 500, 1000, 2000].map((size) => (
                  <Button
                    key={size}
                    type="button"
                    variant={bulkFormData.sizes.includes(size) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const newSizes = bulkFormData.sizes.includes(size)
                        ? bulkFormData.sizes.filter(s => s !== size)
                        : [...bulkFormData.sizes, size].sort((a, b) => a - b);
                      setBulkFormData({ ...bulkFormData, sizes: newSizes });
                    }}
                  >
                    {size >= 1000 ? `${size / 1000}L` : `${size}ml`}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to keep existing size variants unchanged
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setBulkEditOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleBulkUpdate} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update All'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SKU</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{skuToDelete?.code}"? This will also delete all pricing tiers and sizes. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SKUs;
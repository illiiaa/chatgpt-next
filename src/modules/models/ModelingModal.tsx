import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Divider } from '@mui/joy';

import { GoodModal } from '@/common/components/GoodModal';
import { useSettingsStore } from '@/common/state/store-settings';
import { useUIStore } from '@/common/state/store-ui';

import { AddVendor } from './AddVendor';
import { ConfigureSources } from './ConfigureSources';


export function ModelingModal() {

  // external state
  const { modelingOpen, openModeling, closeModeling } = useUIStore();
  const { apiKey } = useSettingsStore(state => ({ apiKey: state.apiKey }), shallow);

  // show the Configuration Dialog at startup if the API key is required but not set
  React.useEffect(() => {
    // if (!hasServerKeyOpenAI && !isValidOpenAIApiKey(apiKey))
    openModeling();
  }, [apiKey, openModeling]);

  return (
    <GoodModal title='Configure AI Models' open={modelingOpen} onClose={closeModeling}>

      <AddVendor />

      <Divider />

      <ConfigureSources />

      {/*<Divider />*/}

      {/* Models List */}
      {/*<Sheet*/}
      {/*  variant='solid'*/}
      {/*  invertedColors*/}
      {/*  sx={{ borderRadius: 'sm', p: 2 }}*/}
      {/*>*/}
      {/*  <div>Model 1</div>*/}
      {/*  <div>Model 2</div>*/}
      {/*  <div>Model 3</div>*/}
      {/*  <div>Model 4</div>*/}
      {/*</Sheet>*/}

    </GoodModal>
  );
}
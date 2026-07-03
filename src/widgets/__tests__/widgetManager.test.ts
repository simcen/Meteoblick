import { updateWidget } from '../widgetManager';
import meteoblickWidget from '../../../widgets/MeteoblickWidget';

// Mock the widget
jest.mock('../../../widgets/MeteoblickWidget', () => ({
  __esModule: true,
  default: {
    updateSnapshot: jest.fn(),
    reload: jest.fn(),
  },
}));

describe('widgetManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateWidget', () => {
    const mockWidgetProps = {
      locationName: 'Frauenkappelen',
      temperature: 22.5,
      symbolCode: 3,
      precipitation: 0.2,
      buildNumber: '260703-1400',
    };

    it('should update widget snapshot with correct props', async () => {
      await updateWidget(mockWidgetProps);

      expect(meteoblickWidget.updateSnapshot).toHaveBeenCalledWith(
        mockWidgetProps
      );
      expect(meteoblickWidget.updateSnapshot).toHaveBeenCalledTimes(1);
    });

    it('should handle all widget props types correctly', async () => {
      const propsWithEdgeCases = {
        locationName: 'Test Location With Spaces & Special Chars',
        temperature: -5.5,
        symbolCode: 15,
        precipitation: 0,
        buildNumber: 'dev',
      };

      await updateWidget(propsWithEdgeCases);

      expect(meteoblickWidget.updateSnapshot).toHaveBeenCalledWith(
        propsWithEdgeCases
      );
    });

    it('should handle widget update errors gracefully', async () => {
      (meteoblickWidget.updateSnapshot as jest.Mock).mockImplementationOnce(
        () => {
          throw new Error('Widget update failed');
        }
      );

      await expect(updateWidget(mockWidgetProps)).rejects.toThrow(
        'Widget update failed'
      );
    });

    it('should update with zero precipitation', async () => {
      const propsWithZeroPrecip = {
        ...mockWidgetProps,
        precipitation: 0,
      };

      await updateWidget(propsWithZeroPrecip);

      expect(meteoblickWidget.updateSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({ precipitation: 0 })
      );
    });

    it('should update with negative temperature', async () => {
      const propsWithNegativeTemp = {
        ...mockWidgetProps,
        temperature: -10.5,
      };

      await updateWidget(propsWithNegativeTemp);

      expect(meteoblickWidget.updateSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: -10.5 })
      );
    });
  });
});
